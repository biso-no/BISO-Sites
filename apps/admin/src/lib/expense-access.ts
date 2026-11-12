import { Query } from "@repo/api";
import { ROLES } from "./roles";
import { NO_MATCH_FILTER } from "./utils/authorization";

export interface ExpenseViewer {
  accountEmail: string | null;
  controllerCampusIds: string[];
  /** Lowercased Microsoft identity emails. */
  emails: string[];
  isCampusAdmin: boolean;
  isGlobalAdmin: boolean;
  managedCampusIds: string[];
  name: string | null;
  userId: string;
}

export interface ExpenseAccessExpense {
  campus: string;
  status: string;
  submitter_is_controller: boolean;
  submitter_is_financial_manager: boolean;
  userId: string;
}

export interface ExpenseAccessStep {
  $id: string;
  approver_email: string;
  approver_role: string;
  status: string;
  step: number;
}

export interface ExpensePermissions {
  canChangeApprover: boolean;
  canDecide: boolean;
  canEdit: boolean;
  canEditBankAccount: boolean;
  canRetryBooking: boolean;
  canView: boolean;
  currentStepId: string | null;
  decideAs: "approver" | "on_behalf" | null;
  isSubmitter: boolean;
}

/** Roles whose step a controller may re-route on behalf of the organisation. */
const CONTROLLER_REROUTABLE_ROLES = ["finance", "manager", "deputy"];

/** The step awaiting a decision: lowest-numbered pending step of a pending expense. */
export function currentPendingStep<T extends ExpenseAccessStep>(
  expenseStatus: string,
  steps: T[]
): T | null {
  if (expenseStatus !== "pending") {
    return null;
  }
  let current: T | null = null;
  for (const step of steps) {
    if (step.status === "pending" && (!current || step.step < current.step)) {
      current = step;
    }
  }
  return current;
}

function campusAdminSees(
  viewer: ExpenseViewer,
  expense: ExpenseAccessExpense
): boolean {
  return (
    viewer.isCampusAdmin && viewer.managedCampusIds.includes(expense.campus)
  );
}

function isStepClosedToSubmitter(
  step: ExpenseAccessStep,
  expense: ExpenseAccessExpense
): boolean {
  if (step.approver_role === "finance") {
    return expense.submitter_is_financial_manager;
  }
  if (step.approver_role === "controller") {
    return expense.submitter_is_controller;
  }
  return false;
}

export function expensePermissions(
  viewer: ExpenseViewer,
  expense: ExpenseAccessExpense,
  steps: ExpenseAccessStep[]
): ExpensePermissions {
  const isSubmitter = viewer.userId === expense.userId;
  const isGlobal = viewer.isGlobalAdmin;
  const controllerHere = viewer.controllerCampusIds.includes(expense.campus);
  const controllerActs = controllerHere && !expense.submitter_is_controller;
  const step = currentPendingStep(expense.status, steps);
  const isViewerEmail = (email: string) =>
    viewer.emails.includes(email.trim().toLowerCase());
  const approverHere =
    step !== null &&
    isViewerEmail(step.approver_email) &&
    !isStepClosedToSubmitter(step, expense);
  const canView =
    isGlobal ||
    controllerHere ||
    isSubmitter ||
    campusAdminSees(viewer, expense) ||
    steps.some((s) => isViewerEmail(s.approver_email));
  const actor = !isSubmitter && (isGlobal || controllerActs);

  // Nothing below applies to the person who submitted the expense.
  const acts = !isSubmitter;
  const canEditPending =
    expense.status === "pending" && (approverHere || actor);
  const canEdit =
    acts && (canEditPending || (expense.status === "failed" && actor));
  const canReroute =
    step !== null &&
    (isGlobal ||
      (controllerActs &&
        CONTROLLER_REROUTABLE_ROLES.includes(step.approver_role)));

  return {
    canChangeApprover: acts && canReroute,
    canDecide: acts && step !== null && (approverHere || actor),
    canEdit,
    canEditBankAccount: canEdit && actor,
    canRetryBooking: expense.status === "failed" && actor,
    canView,
    currentStepId: step?.$id ?? null,
    decideAs: acts ? decideAs(approverHere, actor) : null,
    isSubmitter,
  };
}

function decideAs(
  approverHere: boolean,
  actor: boolean
): "approver" | "on_behalf" | null {
  if (approverHere) {
    return "approver";
  }
  return actor ? "on_behalf" : null;
}

export function canOpenExpensesSection(
  viewer: ExpenseViewer,
  roles: string[]
): boolean {
  return (
    viewer.isGlobalAdmin ||
    viewer.isCampusAdmin ||
    viewer.controllerCampusIds.length > 0 ||
    roles.includes(ROLES.EXPENSE_APPROVER)
  );
}

/** Campuses whose approval issues the viewer may list; `null` means every campus. */
export function issueCampusScope(viewer: ExpenseViewer): string[] | null {
  if (viewer.isGlobalAdmin) {
    return null;
  }
  return [
    ...new Set([
      ...(viewer.isCampusAdmin ? viewer.managedCampusIds : []),
      ...viewer.controllerCampusIds,
    ]),
  ];
}

/** Resolving or re-sending an approval issue: global admins and that campus's controller. */
export function canActOnApprovalIssue(
  viewer: ExpenseViewer,
  campusId: string | null | undefined
): boolean {
  return (
    viewer.isGlobalAdmin ||
    Boolean(campusId && viewer.controllerCampusIds.includes(campusId))
  );
}

/**
 * Appwrite queries limiting an expense list to what the viewer may see:
 * their campuses (managed as campus admin, or as controller) plus the
 * expenses they appear on as an approver.
 */
export function expenseVisibilityQueries(
  viewer: ExpenseViewer,
  approverExpenseIds: string[]
): string[] {
  if (viewer.isGlobalAdmin) {
    return [];
  }
  const campuses = [
    ...new Set([
      ...(viewer.isCampusAdmin ? viewer.managedCampusIds : []),
      ...viewer.controllerCampusIds,
    ]),
  ];
  const sides: string[] = [];
  if (campuses.length > 0) {
    sides.push(Query.equal("campus", campuses));
  }
  if (approverExpenseIds.length > 0) {
    sides.push(Query.equal("$id", approverExpenseIds));
  }
  if (sides.length === 0) {
    return [NO_MATCH_FILTER];
  }
  return [sides.length === 1 ? (sides[0] as string) : Query.or(sides)];
}

/** `"•••• 8903"`: a bank account number reduced to its last four digits. */
export function maskBankAccount(account: string | null | undefined): string {
  const digits = (account ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "••••";
}
