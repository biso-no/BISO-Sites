import "server-only";
import type { UserAuthContext } from "@/lib/authorization";
import { publishBenefit } from "@/lib/benefit-publish";
import { ROLES } from "@/lib/roles";

const BENEFITS_DOMAIN = "benefits";
const JOBS_DOMAIN = "jobs";

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
  if (domain === JOBS_DOMAIN) {
    // Recruitment stays with recruiters: campus admins never publish vacancies.
    return ctx.roles.includes(ROLES.HR) || ctx.roles.includes(ROLES.HR_ADMIN);
  }
  if (domain === BENEFITS_DOMAIN && ctx.roles.includes(ROLES.BENEFITS_EDITOR)) {
    return true;
  }
  return Boolean(campusId && ctx.managedCampusIds.includes(campusId));
}

/**
 * Vacancies are created already published when the caller may publish, so the
 * create step is the publish; every other domain publishes in a second step.
 */
export function createdContentNeedsPublish(domain: string): boolean {
  return domain !== JOBS_DOMAIN;
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
