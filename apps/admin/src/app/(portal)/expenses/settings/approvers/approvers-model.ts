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

/** Campuses an approver row can sit on. */
export const APPROVER_CAMPUS_IDS: readonly string[] = ["1", "2", "3", "4", "5"];
const NATIONAL_CAMPUS_ID = "5";

/** Most approver rows one list shows; the page says when there are more. */
export const APPROVER_LIST_CAP = 500;

/** Why an approver action was refused. Each has a message under `approvers.errors`. */
export type ApproverErrorCode =
  | "invalid_role"
  | "invalid_email"
  | "invalid_campus"
  | "missing_department"
  | "department_mismatch"
  | "forbidden"
  | "role_taken"
  | "failed";

export const APPROVER_ERROR_CODES: readonly ApproverErrorCode[] = [
  "invalid_role",
  "invalid_email",
  "invalid_campus",
  "missing_department",
  "department_mismatch",
  "forbidden",
  "role_taken",
  "failed",
];

export type ApproverActionResult<T> =
  | { data: T }
  | { error: ApproverErrorCode };

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

export interface ApproverList {
  /** True when more rows matched than the list shows. */
  capped: boolean;
  rows: ApproverView[];
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
 * written. A department holds only department roles and a campus only the
 * campus roles; the national approver sits on campus 5 alone. Campus admins
 * may only write department roles of their campuses.
 */
export function parseApproverInput(
  viewer: ApproverViewer,
  input: ApproverInput
): { value: ParsedApproverInput } | { error: ApproverErrorCode } {
  const { scope, role } = input;
  if (!(isApproverScope(scope) && isApproverRole(role))) {
    return { error: "invalid_role" };
  }
  const isDepartmentRole = DEPARTMENT_ROLES.includes(role);
  if ((scope === "department") !== isDepartmentRole) {
    return { error: "invalid_role" };
  }
  const email = normalizeApproverEmail(input.email);
  if (!email) {
    return { error: "invalid_email" };
  }
  const campusId = input.campusId.trim();
  if (!APPROVER_CAMPUS_IDS.includes(campusId)) {
    return { error: "invalid_campus" };
  }
  if (role === "national" && campusId !== NATIONAL_CAMPUS_ID) {
    return { error: "invalid_campus" };
  }
  const departmentId =
    scope === "department" ? (input.departmentId?.trim() ?? "") : null;
  if (scope === "department" && !departmentId) {
    return { error: "missing_department" };
  }
  if (!canEditApproverRow(viewer, { campus_id: campusId, scope })) {
    return { error: "forbidden" };
  }
  return { value: { campusId, departmentId, email, role, scope } };
}

/** The dialog fields `nameAfterEmailChange` reads. */
export interface ApproverNameDraft {
  displayName: string;
  /** The admin typed in the name field. */
  nameTouched: boolean;
  originalEmail: string;
  originalName: string;
}

/**
 * The name to show after the email changes. A name prefilled for another
 * person is cleared, and comes back if the email is changed back. A name the
 * admin typed stays.
 */
export function nameAfterEmailChange(
  draft: ApproverNameDraft,
  email: string
): string {
  if (draft.nameTouched) {
    return draft.displayName;
  }
  const same =
    email.trim().toLowerCase() === draft.originalEmail.trim().toLowerCase();
  return same ? draft.originalName : "";
}
