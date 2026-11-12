// Resolves the ordered expense approval chain into concrete approvers.
//
// The approval plan (packages/shared/utils/expense-approvers.ts) lists the
// steps. Each step is resolved in this order:
//   1. the approver directory (`expense_approvers`), which admins can edit;
//   2. for department steps and the president, a Microsoft 365 lookup where the
//      AI picks among mailbox candidates (only answers with confidence >= 0.8
//      count, and a confident answer is saved to the directory);
//   3. for the controller and national steps, the seeded default mailbox.
// A department step nobody can fill is dropped with an issue, so the controller
// step that follows still approves. A president nobody can fill falls back to
// the national approver with an issue, never to the controller.

import { createAdminClient } from "@repo/api/server";
import type { GraphUserService } from "@repo/connectors/azure/users";
import {
  type ApproverRole,
  DEFAULT_DIRECTORY_EMAILS,
  directoryKey,
  getCampusApprovalPlan,
  NATIONAL_APPROVER_EMAIL,
} from "@repo/shared/utils/expense-approvers";
import {
  findDirectoryApprover,
  saveDirectoryApprover,
  touchDirectoryApprover,
} from "./expense-approver-directory";
import {
  type Candidate,
  chooseApprover,
  findApproverCandidates,
  type LookupRole,
} from "./expense-approver-lookup";
import { getGraphService } from "./graph";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];
type Graph = Pick<GraphUserService, "searchUsers" | "findUsersByDepartment">;

const MIN_CONFIDENCE = 0.8;
/** Resolution runs inside submit; the app gives up after 20 s. */
const AI_TIMEOUT_MS = 6000;
const NATIONAL_CAMPUS_ID = "5";

export interface ResolvedApproverStep {
  /** Azure AD object id, when known. */
  aadId: string | null;
  /** Directory key this approver is stored under. */
  directoryKey: string;
  email: string;
  role: ApproverRole;
  source: "directory" | "ai" | "default";
  step: number;
}

export interface ApproverResolutionIssue {
  campusId: string;
  department: string;
  reason: string;
  roleSought: ApproverRole;
}

export interface ApproverResolution {
  issues: ApproverResolutionIssue[];
  steps: ResolvedApproverStep[];
}

interface ResolveInput {
  campusId: string;
  campusName: string;
  /** Department id ($id) stored on the expense. */
  departmentId: string | null;
  departmentName: string | null;
  // Self-declared by the submitter, and honored as declared. They can't be
  // verified server-side: members submit from personal email accounts.
  submitterIsController: boolean;
  submitterIsFinancialManager: boolean;
}

export interface ResolveDeps {
  candidates?: typeof findApproverCandidates;
  choose?: typeof chooseApprover;
  db?: Db;
  graph?: Graph;
}

type Found = Omit<ResolvedApproverStep, "step">;

export async function resolveExpenseApprovers(
  input: ResolveInput,
  deps: ResolveDeps = {}
): Promise<ApproverResolution> {
  const plan = getCampusApprovalPlan({
    campusId: input.campusId,
    departmentId: input.departmentId ?? undefined,
    submitterIsFinancialManager: input.submitterIsFinancialManager,
    submitterIsController: input.submitterIsController,
  });

  let db = deps.db;
  const getDb = async (): Promise<Db> => {
    if (!db) {
      db = (await createAdminClient()).db;
    }
    return db;
  };
  const graph = deps.graph ?? getGraphService();
  const findCandidates = deps.candidates ?? findApproverCandidates;
  const choose = deps.choose ?? chooseApprover;
  const department = input.departmentName ?? "(none)";

  const fromDirectory = async (
    key: string,
    role: ApproverRole
  ): Promise<Found | null> => {
    const store = await getDb();
    const row = await findDirectoryApprover(store, key);
    if (!row) {
      return null;
    }
    await touchDirectoryApprover(store, key);
    return {
      aadId: row.aadId,
      directoryKey: key,
      email: row.email,
      role,
      source: "directory",
    };
  };

  /** Asks the AI for one role. A failure or timeout counts as not found. */
  const fromAi = async (
    key: string,
    role: LookupRole,
    scope: "department" | "campus"
  ): Promise<Found | null> => {
    let candidates: Candidate[];
    let choice: Awaited<ReturnType<typeof chooseApprover>>;
    try {
      candidates = await findCandidates(graph as never, {
        role,
        campusId: input.campusId,
        departmentName: input.departmentName,
      });
      choice = await choose({
        role,
        campusName: input.campusName,
        departmentName: input.departmentName,
        candidates,
        abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
    } catch (error) {
      console.error(
        `[expense-approver-resolution] ${role} lookup failed`,
        error
      );
      return null;
    }
    if (!choice || choice.confidence < MIN_CONFIDENCE) {
      return null;
    }
    const match = candidates.find(
      (c) => c.email.toLowerCase() === choice.email.toLowerCase()
    );
    await saveDirectoryApprover(await getDb(), {
      key,
      scope,
      campusId: input.campusId,
      departmentId: scope === "department" ? input.departmentId : null,
      role,
      email: choice.email,
      aadId: match?.aadId ?? null,
      displayName: match?.displayName ?? null,
      source: "ai",
      confidence: choice.confidence,
    });
    return {
      aadId: match?.aadId ?? null,
      directoryKey: key,
      email: choice.email,
      role,
      source: "ai",
    };
  };

  const departmentKey = (role: ApproverRole) =>
    directoryKey({
      scope: "department",
      campusId: input.campusId,
      departmentId: input.departmentId,
      role,
    });
  const campusKey = (campusId: string, role: ApproverRole) =>
    directoryKey({ scope: "campus", campusId, role });

  const resolveDepartment = async (
    role: "finance" | "manager"
  ): Promise<Found | null> => {
    if (!(input.departmentId && input.departmentName)) {
      return null;
    }
    const roles: ("finance" | "manager" | "deputy")[] =
      role === "manager" ? ["manager", "deputy"] : ["finance"];
    for (const tryRole of roles) {
      const key = departmentKey(tryRole);
      const found =
        (await fromDirectory(key, tryRole)) ??
        (await fromAi(key, tryRole, "department"));
      if (found) {
        return found;
      }
    }
    return null;
  };

  const seedDefault = async (
    role: "controller" | "national",
    campusId: string
  ): Promise<Found | null> => {
    const key = campusKey(campusId, role);
    const existing = await fromDirectory(key, role);
    if (existing) {
      return existing;
    }
    const email = DEFAULT_DIRECTORY_EMAILS[campusId]?.[role];
    if (!email) {
      return null;
    }
    await saveDirectoryApprover(await getDb(), {
      key,
      scope: "campus",
      campusId,
      role,
      email,
      source: "seed",
    });
    return { aadId: null, directoryKey: key, email, role, source: "default" };
  };

  const resolveDirectory = async (
    role: "controller" | "president" | "national",
    issues: ApproverResolutionIssue[]
  ): Promise<Found | null> => {
    if (role !== "president") {
      return seedDefault(role, input.campusId);
    }
    const key = campusKey(input.campusId, "president");
    const found =
      (await fromDirectory(key, "president")) ??
      (await fromAi(key, "president", "campus"));
    if (found) {
      return found;
    }
    issues.push({
      campusId: input.campusId,
      department,
      roleSought: "president",
      reason: `No president approver found for campus ${input.campusId}; sent to the national approver (${NATIONAL_APPROVER_EMAIL}).`,
    });
    return seedDefault("national", NATIONAL_CAMPUS_ID);
  };

  const steps: ResolvedApproverStep[] = [];
  const issues: ApproverResolutionIssue[] = [];

  for (const planStep of plan) {
    let found: Found | null;
    if (planStep.kind === "directory") {
      found = await resolveDirectory(planStep.role, issues);
    } else {
      found = await resolveDepartment(planStep.role);
      if (!found) {
        issues.push({
          campusId: input.campusId,
          department,
          roleSought: planStep.role,
          reason: input.departmentName
            ? `No ${planStep.role} approver found for department "${input.departmentName}".`
            : "Expense has no department set.",
        });
      }
    }
    if (found) {
      steps.push({ ...found, step: steps.length + 1 });
    }
  }

  return { steps, issues };
}
