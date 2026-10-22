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
