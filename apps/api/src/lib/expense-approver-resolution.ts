// Resolves the ordered expense approval chain into concrete approvers.
//
// The approval plan (packages/shared/utils/expense-approvers.ts) lists the
// steps. Each step is resolved in this order:
//   1. the approver directory (`expense_approvers`), which admins can edit;
//   2. for department steps and the president, a Microsoft 365 lookup where the
//      AI picks among mailbox candidates (only answers with confidence >= 0.8
//      count, and a confident answer is saved to the directory);
//   3. for the controller and national steps, the seeded default mailbox.
// Steps resolve concurrently; order and numbering follow the plan. A department
// step nobody can fill is dropped with an issue, so the controller step that
// follows still approves. A president nobody can fill falls back to
// the national approver with an issue, never to the controller.

import { createAdminClient } from "@repo/api/server";
import type { GraphUserService } from "@repo/connectors/azure/users";
import {
  type ApproverRole,
  DEFAULT_DIRECTORY_EMAILS,
  directoryKey,
  getCampusApprovalPlan,
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

/** A found approver plus the bookkeeping to run only if it is the one used. */
interface Lookup {
  commit: () => Promise<void> | void;
  found: Found;
}

interface StepOutcome {
  found: Found | null;
  issues: ApproverResolutionIssue[];
}

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
  // Graph is only needed by the AI path; missing config there means "not found".
  let graph = deps.graph;
  const getGraph = (): Graph => {
    graph ??= getGraphService();
    return graph;
  };
  const findCandidates = deps.candidates ?? findApproverCandidates;
  const choose = deps.choose ?? chooseApprover;
  const department = input.departmentName ?? "(none)";

  const fromDirectory = async (
    key: string,
    role: ApproverRole
  ): Promise<Lookup | null> => {
    const store = await getDb();
    const row = await findDirectoryApprover(store, key);
    if (!row) {
      return null;
    }
    return {
      found: {
        aadId: row.aadId,
        directoryKey: key,
        email: row.email,
        role,
        source: "directory",
      },
      commit: () => {
        touchDirectoryApprover(store, key).catch((error: unknown) =>
          console.error("[expense-approver-resolution] touch failed", error)
        );
      },
    };
  };

  /** Asks the AI for one role. A failure or timeout counts as not found. */
  const fromAi = async (
    key: string,
    role: LookupRole,
    scope: "department" | "campus"
  ): Promise<Lookup | null> => {
    let candidates: Candidate[];
    let choice: Awaited<ReturnType<typeof chooseApprover>>;
    try {
      candidates = await findCandidates(getGraph(), {
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
    const { confidence, email } = choice;
    const match = candidates.find(
      (c) => c.email.toLowerCase() === email.toLowerCase()
    );
    return {
      found: {
        aadId: match?.aadId ?? null,
        directoryKey: key,
        email,
        role,
        source: "ai",
      },
      commit: async () =>
        saveDirectoryApprover(await getDb(), {
          key,
          scope,
          campusId: input.campusId,
          departmentId: scope === "department" ? input.departmentId : null,
          role,
          email,
          aadId: match?.aadId ?? null,
          displayName: match?.displayName ?? null,
          source: "ai",
          confidence,
        }),
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

  /** Directory first; the AI only with a department name to search by. */
  const departmentLookup = async (
    role: "finance" | "manager" | "deputy"
  ): Promise<Lookup | null> => {
    const key = departmentKey(role);
    return (
      (await fromDirectory(key, role)) ??
      (input.departmentName ? await fromAi(key, role, "department") : null)
    );
  };

  const managerOrDeputy = async (): Promise<[Lookup | null, Lookup | null]> => {
    const managerKey = departmentKey("manager");
    const inDirectory = await fromDirectory(managerKey, "manager");
    if (inDirectory) {
      return [inDirectory, null];
    }
    return Promise.all([
      input.departmentName
        ? fromAi(managerKey, "manager", "department")
        : Promise.resolve(null),
      departmentLookup("deputy"),
    ]);
  };

  const resolveDepartment = async (
    role: "finance" | "manager"
  ): Promise<StepOutcome> => {
    if (!input.departmentId) {
      return {
        found: null,
        issues: [
          {
            campusId: input.campusId,
            department,
            roleSought: role,
            reason: "Expense has no department set.",
          },
        ],
      };
    }
    // A manager in the directory ends the search. Otherwise the AI looks for the
    // manager and the deputy at once, and a manager wins when both resolve.
    const [first, second] =
      role === "manager"
        ? await managerOrDeputy()
        : [await departmentLookup("finance"), null];
    const picked = first ?? second;
    if (picked) {
      await picked.commit();
      return { found: picked.found, issues: [] };
    }
    const why = input.departmentName
      ? `No ${role} approver in the directory or found by the lookup for department "${input.departmentName}".`
      : `No ${role} approver in the directory, and the expense has no department name to search by.`;
    return {
      found: null,
      issues: [
        { campusId: input.campusId, department, roleSought: role, reason: why },
      ],
    };
  };

  const seedDefault = async (
    role: "controller" | "national",
    campusId: string
  ): Promise<Found | null> => {
    const key = campusKey(campusId, role);
    const existing = await fromDirectory(key, role);
    if (existing) {
      await existing.commit();
      return existing.found;
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
    role: "controller" | "president" | "national"
  ): Promise<StepOutcome> => {
    if (role !== "president") {
      return { found: await seedDefault(role, input.campusId), issues: [] };
    }
    const key = campusKey(input.campusId, "president");
    const lookup =
      (await fromDirectory(key, "president")) ??
      (await fromAi(key, "president", "campus"));
    if (lookup) {
      await lookup.commit();
      return { found: lookup.found, issues: [] };
    }
    const national = await seedDefault("national", NATIONAL_CAMPUS_ID);
    return {
      found: national,
      issues: [
        {
          campusId: input.campusId,
          department,
          roleSought: "president",
          reason: national
            ? `No president approver found for campus ${input.campusId}; sent to the national approver (${national.email}).`
            : `No president approver found for campus ${input.campusId}, and no national approver is configured.`,
        },
      ],
    };
  };

  const outcomes = await Promise.all(
    plan.map((planStep) =>
      planStep.kind === "directory"
        ? resolveDirectory(planStep.role)
        : resolveDepartment(planStep.role)
    )
  );

  const steps: ResolvedApproverStep[] = [];
  const issues: ApproverResolutionIssue[] = [];
  for (const outcome of outcomes) {
    issues.push(...outcome.issues);
    if (outcome.found) {
      steps.push({ ...outcome.found, step: steps.length + 1 });
    }
  }
  return { steps, issues };
}
