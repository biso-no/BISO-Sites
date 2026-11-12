/**
 * Expense/reimbursement approver routing (pure, framework-agnostic).
 *
 * Determines the ordered approval plan for a reimbursement: which roles approve,
 * in what order, per campus. The api layer turns the plan into concrete people
 * (see `apps/api/src/lib/expense-approver-resolution.ts`): the approver
 * directory first, then an AI lookup in Microsoft 365, then seeded defaults.
 *
 * Plan rules:
 * - Oslo (campus 1), ordinary departments: (1) the department financial manager
 *   (or the department manager, when the submitter declares they are the
 *   financial manager), then (2) the campus controller.
 * - Drift Campus and Ledelsen on every campus 1-4 offer a controller switch:
 *   normally the campus controller approves (1 step); a submitter who is the
 *   controller goes to the campus president instead, never to a controller.
 * - Bergen / Trondheim / Stavanger, other departments: the campus controller.
 * - National (campus 5): the national manager mailbox, manager@biso.no.
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

/** Campus id → every mailbox slug a campus is known by. */
export const CAMPUS_MAILBOX_SLUGS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    "1": Object.freeze(["oslo"]),
    "2": Object.freeze(["bergen"]),
    "3": Object.freeze(["trondheim", "trd"]),
    "4": Object.freeze(["stavanger"]),
  });

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
  if (!CAMPUS_MAILBOX_SLUGS[campusId]) {
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
