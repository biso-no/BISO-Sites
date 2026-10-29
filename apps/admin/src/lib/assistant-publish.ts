import "server-only";
import type { UserAuthContext } from "@/lib/authorization";
import { publishBenefit } from "@/lib/benefit-publish";
import { ROLES } from "@/lib/roles";

const BENEFITS_DOMAIN = "benefits";

/** Publishes a benefit with fresh permissions (published -> read("any")). */
export function publishBenefitContent(id: string) {
  return publishBenefit(id);
}

/** Benefits have no department; drop any the assistant supplied. */
export function dropBenefitDepartment(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const {
    department: _department,
    departmentId: _departmentId,
    department_id: _departmentSnake,
    ...rest
  } = payload;
  return rest;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The facts a create confirmation card shows are the ones the route writes:
 * status from the confirmed publish choice, campus and department from the
 * resolved values. Anything the model put in the payload for those fields is
 * replaced. Benefits have no department.
 */
export function applyConfirmedCreateFacts(
  domain: string,
  payload: Record<string, unknown>,
  confirmed: {
    campusId?: string;
    departmentId?: string;
    status: "draft" | "published";
  }
): Record<string, unknown> {
  const campusId =
    confirmed.campusId ??
    stringOrNull(payload.campus_id) ??
    stringOrNull(payload.campusId);
  const departmentId =
    confirmed.departmentId ??
    stringOrNull(payload.department_id) ??
    stringOrNull(payload.department);
  const {
    campusId: _campusAlias,
    department: _departmentAlias,
    departmentId: _departmentIdAlias,
    ...rest
  } = payload;
  const next: Record<string, unknown> = { ...rest, status: confirmed.status };
  if (campusId) {
    next.campus_id = campusId;
  }
  if (domain === BENEFITS_DOMAIN) {
    return dropBenefitDepartment(next);
  }
  if (departmentId) {
    next.department_id = departmentId;
  }
  return next;
}

/**
 * A benefit as the assistant may see it: never its code or member link,
 * which only the panel shows to the benefit's own editors.
 */
export function withoutBenefitCode<T extends { redemption_value?: unknown }>(
  benefit: T
): Omit<T, "redemption_value"> {
  const { redemption_value: _code, ...rest } = benefit;
  return rest;
}

export function canPublishContent(
  ctx: UserAuthContext,
  domain: string,
  campusId: string | null
): boolean {
  if (ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    return true;
  }
  if (domain === BENEFITS_DOMAIN && ctx.roles.includes(ROLES.BENEFITS_EDITOR)) {
    return true;
  }
  return Boolean(campusId && ctx.managedCampusIds.includes(campusId));
}

export function assistantRoleSummary(ctx: UserAuthContext): string {
  if (ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    return "Global admin (full access to all campuses)";
  }
  if (ctx.roles.includes(ROLES.CAMPUS_ADMIN)) {
    return `Campus admin — manages: ${ctx.managedCampuses.join(", ")}`;
  }
  if (ctx.roles.includes(ROLES.BENEFITS_EDITOR)) {
    return "Benefits editor — full access to Fordeler (benefits on every campus)";
  }
  if (ctx.departmentTeamIds.length > 0) {
    return `Department member — departments: ${ctx.departmentNames.join(", ")}`;
  }
  return "Read-only (no write access)";
}

/**
 * The assistant never sees a benefit's code, so its update never carries one.
 * A model that sends "" or null after a refusal would otherwise clear the
 * stored code; without the field, updateBenefit keeps the stored code.
 */
export function benefitUpdateFromAssistant(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return withoutBenefitCode(payload);
}
