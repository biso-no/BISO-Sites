import { EXPENSE_APPROVER_DOMAIN } from "@repo/shared/utils/expense-approvers";

const WHITESPACE = /\s/;

export type ApproverScope = "department" | "campus";
export type ApproverRoleKey =
  | "finance"
  | "manager"
  | "deputy"
  | "controller"
  | "president"
  | "national";
export type ApproverSource = "seed" | "ai" | "admin" | "confirmed";

export const APPROVER_SCOPES: readonly ApproverScope[] = [
  "department",
  "campus",
];
export const APPROVER_ROLES: readonly ApproverRoleKey[] = [
  "finance",
  "manager",
  "deputy",
  "controller",
  "president",
  "national",
];
/** Roles that belong to one department; campus admins may only touch these. */
export const DEPARTMENT_ROLES: readonly ApproverRoleKey[] = [
  "finance",
  "manager",
  "deputy",
];

export interface ApproverViewer {
  isCampusAdmin: boolean;
  isGlobalAdmin: boolean;
  managedCampusIds: string[];
}

export interface ApproverFilters {
  campusId: string | null;
  q: string;
  role: string | null;
}

export interface ApproverInput {
  campusId: string;
  departmentId?: string | null;
  displayName?: string | null;
  email: string;
  id?: string;
  role: string;
  scope: string;
}

export interface ApproverView {
  $id: string;
  active: boolean;
  campusId: string;
  confidence: number | null;
  confirmedAt: string | null;
  departmentId: string | null;
  departmentName: string | null;
  displayName: string | null;
  /** Whether the viewer may edit this row; the server re-checks on write. */
  editable: boolean;
  email: string;
  lastUsedAt: string | null;
  role: string;
  scope: string;
  source: string;
}

/**
 * Global admins edit any row. Campus admins edit department-scope rows of the
 * campuses they manage. Nobody else edits anything.
 */
export function canEditApproverRow(
  viewer: ApproverViewer,
  row: { scope: string; campus_id: string }
): boolean {
  if (viewer.isGlobalAdmin) {
    return true;
  }
  return (
    viewer.isCampusAdmin &&
    row.scope === "department" &&
    viewer.managedCampusIds.includes(row.campus_id)
  );
}

/** Trimmed, lowercased `@biso.no` address, or null when it is not one. */
export function normalizeApproverEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  const [local, domain, ...rest] = email.split("@");
  if (!local || rest.length > 0 || domain !== EXPENSE_APPROVER_DOMAIN) {
    return null;
  }
  return WHITESPACE.test(local) ? null : email;
}

export function isApproverScope(value: string): value is ApproverScope {
  return (APPROVER_SCOPES as readonly string[]).includes(value);
}

export function isApproverRole(value: string): value is ApproverRoleKey {
  return (APPROVER_ROLES as readonly string[]).includes(value);
}

export interface ParsedApproverInput {
  campusId: string;
  departmentId: string | null;
  email: string;
  role: ApproverRoleKey;
  scope: ApproverScope;
}

/**
 * Validates a save request for this viewer before anything is read or
 * written. Campus admins may only write department roles of their campuses.
 */
export function parseApproverInput(
  viewer: ApproverViewer,
  input: ApproverInput
): { value: ParsedApproverInput } | { error: string } {
  const { scope, role } = input;
  if (!(isApproverScope(scope) && isApproverRole(role))) {
    return { error: "Invalid scope or role" };
  }
  const email = normalizeApproverEmail(input.email);
  if (!email) {
    return { error: "The email must be an @biso.no address" };
  }
  const campusId = input.campusId.trim();
  if (!campusId) {
    return { error: "Choose a campus" };
  }
  const departmentId =
    scope === "department" ? (input.departmentId?.trim() ?? "") : null;
  if (scope === "department" && !departmentId) {
    return { error: "Choose a department" };
  }
  const isDepartmentRole = DEPARTMENT_ROLES.includes(role);
  if (!(viewer.isGlobalAdmin || (scope === "department" && isDepartmentRole))) {
    return { error: "Forbidden: campus admins manage department roles only" };
  }
  if (!canEditApproverRow(viewer, { campus_id: campusId, scope })) {
    return { error: "Forbidden: this approver is outside your campus" };
  }
  return { value: { campusId, departmentId, email, role, scope } };
}
