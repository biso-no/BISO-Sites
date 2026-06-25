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
 *   resolved via Graph by department name; (2) the campus controller.
 * - Bergen / Trondheim / Stavanger (2/3/4): 1 step — the campus controller.
 * - National (campus 5): 1 step — simen@biso.no.
 * - Department roles are matched by the email local-part prefix (financial
 *   managers start with "financ", managers "manag", deputies "deput") because
 *   the exact mailbox varies (finance. vs financial. etc.).
 */

export type ApproverRole =
  | "finance"
  | "manager"
  | "deputy"
  | "controller"
  | "national";

/** Department-level role a step initially asks for (Oslo only). */
export type DepartmentApproverRole = "finance" | "manager";

export interface ApprovalStepPlan {
  /** Present for fixed steps (controller / national). */
  email?: string;
  /** "department" steps are resolved via Graph; "fixed" carry a known email. */
  kind: "department" | "fixed";
  role: ApproverRole;
}

export interface ApprovalPlanInput {
  /** Campus id as stored on the expense ("1".."5"). */
  campusId: string;
  /** True when the submitter is the department financial manager (Oslo only). */
  submitterIsFinancialManager?: boolean;
}

export const EXPENSE_APPROVER_DOMAIN = "biso.no";
export const NATIONAL_APPROVER_EMAIL = `markus@${EXPENSE_APPROVER_DOMAIN}`;

const OSLO_CAMPUS_ID = "1";
const NATIONAL_CAMPUS_ID = "5";

/** Campus id → email slug used in role mailboxes. */
const CAMPUS_EMAIL_SLUGS: Record<string, string> = {
  "1": "oslo",
  "2": "bergen",
  "3": "trondheim",
  "4": "stavanger",
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

function controllerEmail(campusId: string): string {
  const slug = CAMPUS_EMAIL_SLUGS[campusId];
  return `controller.${slug}@${EXPENSE_APPROVER_DOMAIN}`;
}

/**
 * Builds the ordered approval plan for a campus. Department steps still need a
 * Graph lookup to resolve the actual approver; fixed steps already carry their
 * email. Throws on an unknown campus.
 */
export function getCampusApprovalPlan(
  input: ApprovalPlanInput
): ApprovalStepPlan[] {
  const { campusId, submitterIsFinancialManager = false } = input;

  if (campusId === NATIONAL_CAMPUS_ID) {
    return [
      { kind: "fixed", role: "national", email: NATIONAL_APPROVER_EMAIL },
    ];
  }

  const slug = CAMPUS_EMAIL_SLUGS[campusId];
  if (!slug) {
    throw new Error(`Unknown campus id "${campusId}" for expense approval`);
  }

  if (campusId === OSLO_CAMPUS_ID) {
    return [
      {
        kind: "department",
        role: submitterIsFinancialManager ? "manager" : "finance",
      },
      { kind: "fixed", role: "controller", email: controllerEmail(campusId) },
    ];
  }

  return [
    { kind: "fixed", role: "controller", email: controllerEmail(campusId) },
  ];
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
