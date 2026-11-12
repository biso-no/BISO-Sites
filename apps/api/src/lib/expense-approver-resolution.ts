// Resolves the ordered expense approval chain into concrete approvers.
//
// The approval plan (packages/shared/utils/expense-approvers.ts) lists the
// steps. Each step is resolved in this order:
//   1. the approver directory (`expense_approvers`), which admins can edit;
//   2. for department steps and the president, a Microsoft 365 lookup where the
//      AI picks among mailbox candidates (only answers with confidence >= 0.8
//      count, and a confident answer is saved to the directory). Graph and the
//      model share one 8 s deadline per lookup, and a key the lookup found
//      nobody for is not looked up again for an hour;
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
/**
 * One deadline for each AI lookup, Graph and the model together. Resolution
 * runs inside submit, and the old app gives up after 20 s.
 */
const LOOKUP_TIMEOUT_MS = 8000;
/** How long a key the lookup found nobody for is left alone. */
const MISS_TTL_MS = 60 * 60 * 1000;
const NATIONAL_CAMPUS_ID = "5";

/**
 * Directory key → when the AI lookup last found nobody for it. Kept in this
 * process only, so a restart forgets it.
 */
const lookupMisses = new Map<string, number>();

/** Forgets every remembered miss. */
export function forgetLookupMisses(): void {
  lookupMisses.clear();
}

/** True while a miss for this key is less than an hour old. */
function missedRecently(key: string, now: number): boolean {
  const missedAt = lookupMisses.get(key);
  if (missedAt === undefined) {
    return false;
  }
  if (now - missedAt < MISS_TTL_MS) {
    return true;
  }
  lookupMisses.delete(key);
  return false;
}

/** Rejects with the signal's reason once it aborts. */
function aborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}

export interface ResolvedApproverStep {
  /** Azure AD object id, when known. */
  aadId: string | null;
  /** Directory key this approver is stored under. */
  directoryKey: string;
  email: string;
  /** The role this step approves in place of, when it is a fallback. */
  fallbackFor?: ApproverRole;
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
  /** Overrides the 8 s deadline of each AI lookup. */
  lookupTimeoutMs?: number;
  /** The clock the miss cache reads. */
  now?: () => number;
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
  const timeoutMs = deps.lookupTimeoutMs ?? LOOKUP_TIMEOUT_MS;
  const now = deps.now ?? Date.now;
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
    lookupMisses.delete(key);
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

  /**
   * Graph candidates and the model's choice for one role, inside one
   * deadline. A failure or the deadline counts as nobody found.
   */
  const askAi = async (
    role: LookupRole
  ): Promise<{
    candidates: Candidate[];
    choice: Awaited<ReturnType<typeof chooseApprover>>;
  } | null> => {
    const signal = AbortSignal.timeout(timeoutMs);
    const lookup = async () => {
      const candidates = await findCandidates(getGraph(), {
        role,
        campusId: input.campusId,
        departmentName: input.departmentName,
      });
      const choice = await choose({
        role,
        campusName: input.campusName,
        departmentName: input.departmentName,
        candidates,
        abortSignal: signal,
      });
      return { candidates, choice };
    };
    try {
      return await Promise.race([lookup(), aborted(signal)]);
    } catch (error) {
      console.error(
        `[expense-approver-resolution] ${role} lookup failed`,
        error
      );
      return null;
    }
  };

  /**
   * Asks the AI for one role, unless it found nobody for this key in the last
   * hour. Nobody found is remembered; a find clears it.
   */
  const fromAi = async (
    key: string,
    role: LookupRole,
    scope: "department" | "campus"
  ): Promise<Lookup | null> => {
    if (missedRecently(key, now())) {
      return null;
    }
    const answer = await askAi(role);
    const choice = answer?.choice;
    if (!(answer && choice) || choice.confidence < MIN_CONFIDENCE) {
      lookupMisses.set(key, now());
      return null;
    }
    lookupMisses.delete(key);
    const { candidates } = answer;
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

  /**
   * Manager first: the directory's manager, then a confident AI manager, then
   * the directory's deputy, then a confident AI deputy. Without a manager in
   * the directory, the AI manager and the deputy are looked up at once.
   */
  const managerOrDeputy = async (): Promise<Lookup | null> => {
    const managerKey = departmentKey("manager");
    const inDirectory = await fromDirectory(managerKey, "manager");
    if (inDirectory) {
      return inDirectory;
    }
    const [aiManager, deputy] = await Promise.all([
      input.departmentName
        ? fromAi(managerKey, "manager", "department")
        : Promise.resolve(null),
      departmentLookup("deputy"),
    ]);
    return aiManager ?? deputy;
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
    const picked =
      role === "manager"
        ? await managerOrDeputy()
        : await departmentLookup("finance");
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
      // Shown as a fallback, wherever the national mailbox came from.
      found: national
        ? { ...national, fallbackFor: "president", source: "default" }
        : null,
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
