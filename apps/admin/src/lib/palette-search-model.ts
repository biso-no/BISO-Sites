import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import { hasNavAccess } from "@/lib/roles";

export type PaletteEntityGroup =
  | "departments"
  | "events"
  | "jobs"
  | "news"
  | "orders"
  | "pages"
  | "products";

export interface PaletteSearchHit {
  group: PaletteEntityGroup;
  href: string;
  id: string;
  subtitle: string | null;
  title: string;
}

/** Matches the fail-closed sentinel used by applyScopeQueries. */
const NO_SCOPE_FILTER = Query.equal("$id", "__no_scope_resolved__");

/**
 * Jobs scope by relationship (campus.$id) for the HR/global roles that may
 * reach recruitment at all. HR members search every vacancy in their campus;
 * anyone else fails closed (the palette additionally gates on portal.jobs).
 */
export function jobScopeQueries(ctx: UserAuthContext): string[] {
  if (ctx.roles.includes("globaladmin")) {
    return ctx.activeCampusId
      ? [Query.equal("campus.$id", [ctx.activeCampusId])]
      : [];
  }
  if (ctx.roles.includes("hr") && ctx.resolvedCampusIds.length > 0) {
    return [Query.equal("campus.$id", ctx.resolvedCampusIds)];
  }
  return [NO_SCOPE_FILTER];
}

/**
 * Global admins and campus admins scope by the flat campus_id column
 * (mirrors listDepartments); a plain department member scopes by their own
 * resolved department ids, matching canManageDepartment's exclusive
 * precedence — every hit the palette surfaces must be one the user can
 * actually open via /departments/[id].
 */
export function departmentScopeQueries(ctx: UserAuthContext): string[] {
  if (ctx.roles.includes("globaladmin")) {
    return ctx.activeCampusId
      ? [Query.equal("campus_id", [ctx.activeCampusId])]
      : [];
  }
  if (ctx.managedCampusIds.length > 0) {
    return [Query.equal("campus_id", ctx.managedCampusIds)];
  }
  if (ctx.resolvedDepartmentIds.length > 0) {
    return [Query.equal("$id", ctx.resolvedDepartmentIds)];
  }
  return [NO_SCOPE_FILTER];
}

export function canSearchDepartments(ctx: UserAuthContext): boolean {
  return hasNavAccess(
    "portal.departments",
    ctx.roles,
    ctx.departmentTeamIds.length > 0
  );
}

interface TranslationLike {
  locale?: string | null;
  title?: string | null;
}

export function pickTitle(translations: unknown, fallback: string): string {
  if (!Array.isArray(translations)) {
    return fallback;
  }
  const rows = translations.filter(
    (row): row is TranslationLike => typeof row === "object" && row !== null
  );
  const norwegian = rows.find((row) => row.locale === "no" && row.title);
  const english = rows.find((row) => row.locale === "en" && row.title);
  const any = rows.find((row) => row.title);
  return norwegian?.title ?? english?.title ?? any?.title ?? fallback;
}

/**
 * Deep-link when a matching [id] route exists (jobs/events/news/departments
 * have one, product detail is /shop/[id], the page editor is /pages/[id]);
 * orders have no detail route, so they land on their list page.
 */
export function buildHitHref(group: PaletteEntityGroup, id: string): string {
  switch (group) {
    case "departments":
      return `/departments/${id}`;
    case "events":
      return `/events/${id}`;
    case "jobs":
      return `/jobs/${id}`;
    case "news":
      return `/news/${id}`;
    case "orders":
      return "/shop";
    case "pages":
      return `/pages/${id}`;
    case "products":
      return `/shop/${id}`;
    default:
      return "/";
  }
}
