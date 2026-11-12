/**
 * Expense/reimbursement approver routing (pure, framework-agnostic).
 *
 * Determines the ordered approval chain for a reimbursement. The **structure**
 * (which roles approve, in what order, per campus) and the **role-mailbox
 * matching** logic live here and are unit-tested. The actual department
 * approver is looked up in Microsoft Graph by the api layer (see
 * `apps/api/src/lib/expense-approver-resolution.ts`), which feeds candidate
 * users into `pickApproverByRole`.
 *
 * Rules (see plan):
 * - Oslo (campus 1): 2 steps — (1) the department financial manager (or, when
 *   the submitter IS the financial manager, the department manager → deputy),
 *   resolved via Graph by department name; (2) the campus controller. Exception:
 *   Ledelsen Oslo (department 2) has no department financial manager, so it is
 *   controller-only (1 step).
 * - Bergen / Trondheim / Stavanger (2/3/4): 1 step — the campus controller.
 * - National (campus 5): 1 step — the national manager mailbox,
 *   manager@biso.no.
 * - Department roles are matched by the email local-part prefix (financial
 *   managers start with "financ", managers "manag", deputies "deput") because
 *   the exact mailbox varies (finance. vs financial. etc.).
 */

export type ApproverRole =
  | "finance"
  | "manager"
  | "deputy"
  | "controller"
  | "president"
  | "national";

/** Department-level role a step initially asks for (Oslo only). */
export type DepartmentApproverRole = "finance" | "manager";

/** Roles looked up in the approver directory (per campus or department). */
export type DirectoryApproverRole = "controller" | "president" | "national";

export type ApprovalSwitch = "financial_manager" | "controller";

export type ApprovalStepPlan =
  | { kind: "department"; role: DepartmentApproverRole }
  | { kind: "directory"; role: DirectoryApproverRole };

export interface ApprovalPlanInput {
  /** Campus id as stored on the expense ("1".."5"). */
  campusId: string;
  /** Department id ($id, equal to the Finago id) stored on the expense. */
  departmentId?: string | null;
  /** The submitter declared they are the campus controller. */
  submitterIsController?: boolean;
  /** The submitter declared they are the department financial manager. */
  submitterIsFinancialManager?: boolean;
}

export const EXPENSE_APPROVER_DOMAIN = "biso.no";
export const NATIONAL_APPROVER_EMAIL = `manager@${EXPENSE_APPROVER_DOMAIN}`;

const OSLO_CAMPUS_ID = "1";
const NATIONAL_CAMPUS_ID = "5";

/** Drift Campus and Ledelsen per campus (Finago department ids). */
const CAMPUS_LEADERSHIP_DEPARTMENTS: Record<string, readonly string[]> = {
  "1": ["1", "2"],
  "2": ["300", "301"],
  "3": ["600", "601"],
  "4": ["800", "801"],
};

/** Campus id → email slug used in role mailboxes. */
const CAMPUS_EMAIL_SLUGS: Record<string, string> = {
  "1": "oslo",
  "2": "bergen",
  "3": "trondheim",
  "4": "stavanger",
};

/** Campus id → every mailbox slug a campus is known by. */
export const CAMPUS_MAILBOX_SLUGS: Record<string, string[]> = {
  "1": ["oslo"],
  "2": ["bergen"],
  "3": ["trondheim", "trd"],
  "4": ["stavanger"],
};

/** Fallback approvers used until the directory has an entry. */
export const DEFAULT_DIRECTORY_EMAILS: Record<
  string,
  Partial<Record<"controller" | "national", string>>
> = {
  "1": { controller: "controller.oslo@biso.no" },
  "2": { controller: "controller.bergen@biso.no" },
  "3": { controller: "controller.trondheim@biso.no" },
  "4": { controller: "controller.stavanger@biso.no" },
  "5": { national: NATIONAL_APPROVER_EMAIL },
};

/** Email local-part prefixes used to identify role mailboxes. */
export const ROLE_EMAIL_PREFIXES = {
  finance: "financ",
  manager: "manag",
  deputy: "deput",
} as const;

export function getCampusEmailSlug(campusId: string): string | undefined {
  return CAMPUS_EMAIL_SLUGS[campusId];
}

/** Which self-declaration switch the submit form offers for a department. */
export function approvalSwitchFor(
  campusId: string,
  departmentId: string | null | undefined
): ApprovalSwitch | null {
  if (CAMPUS_LEADERSHIP_DEPARTMENTS[campusId]?.includes(departmentId ?? "")) {
    return "controller";
  }
  return campusId === OSLO_CAMPUS_ID ? "financial_manager" : null;
}

export function directoryKey(input: {
  scope: "department" | "campus";
  campusId: string;
  departmentId?: string | null;
  role: ApproverRole;
}): string {
  if (input.scope === "department") {
    return `dept:${input.departmentId ?? ""}:${input.role}`;
  }
  return `campus:${input.campusId}:${input.role}`;
}

/**
 * Builds the ordered approval plan. A switch the department does not offer is
 * treated as off. With the controller switch on there is never a controller
 * step: the expense goes to the president instead. Throws on an unknown campus.
 */
export function getCampusApprovalPlan(
  input: ApprovalPlanInput
): ApprovalStepPlan[] {
  const { campusId, departmentId } = input;

  if (campusId === NATIONAL_CAMPUS_ID) {
    return [{ kind: "directory", role: "national" }];
  }
  if (!CAMPUS_EMAIL_SLUGS[campusId]) {
    throw new Error(`Unknown campus id "${campusId}" for expense approval`);
  }

  const offered = approvalSwitchFor(campusId, departmentId);
  const controllerStep: ApprovalStepPlan = {
    kind: "directory",
    role: "controller",
  };

  if (offered === "controller") {
    return [
      input.submitterIsController
        ? { kind: "directory", role: "president" }
        : controllerStep,
    ];
  }

  if (offered === "financial_manager") {
    return [
      {
        kind: "department",
        role: input.submitterIsFinancialManager ? "manager" : "finance",
      },
      controllerStep,
    ];
  }

  return [controllerStep];
}

/**
 * Picks the candidate whose email local-part starts with `rolePrefix`. When
 * several match (e.g. the same department name exists at multiple campuses),
 * disambiguates by the campus slug embedded in the mailbox. Returns null when
 * nothing matches or the match stays ambiguous — the caller then records a
 * remediation issue and falls back to the campus controller.
 */
export function pickApproverByRole<T extends { email?: string | null }>(
  candidates: readonly T[],
  rolePrefix: string,
  campusSlug: string
): T | null {
  const prefix = rolePrefix.toLowerCase();
  const matches = candidates.filter((candidate) => {
    const email = candidate.email?.toLowerCase();
    if (!email) {
      return false;
    }
    const localPart = email.split("@")[0] ?? "";
    return localPart.startsWith(prefix);
  });

  if (matches.length === 0) {
    return null;
  }
  if (matches.length === 1) {
    return matches[0] ?? null;
  }

  const slug = campusSlug.toLowerCase();
  const campusMatches = matches.filter((candidate) => {
    const email = candidate.email?.toLowerCase() ?? "";
    return email.includes(`.${slug}@`) || email.includes(`.${slug}.`);
  });

  return campusMatches.length === 1 ? (campusMatches[0] ?? null) : null;
}
