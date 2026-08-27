/**
 * Department (unit) domain logic.
 *
 * Plain module, NOT "use server": these are synchronous helpers imported by
 * server-action files, which may only export async functions themselves.
 */

import {
  normalizeForCompare,
  stripClosedSuffix,
} from "./it/department-matching";
import { ROLES } from "./roles";

const WHITESPACE_TO_DASH = /\s+/g;
const NON_SLUG_CHARS = /[^a-z0-9-]/g;
const REPEATED_DASH = /-{2,}/g;
const EDGE_DASH = /^-+|-+$/g;
const MAX_SLUG_ATTEMPTS = 1000;

/**
 * `pages.slug` is string(128) and a unit page's slug is
 * `units/<campus-segment>/<department-slug>` — 16 characters of prefix at the
 * longest campus ("units/trondheim/"), plus room for a `-NN` collision suffix.
 * A 24SO unit name has no length limit of its own, so cap the department slug
 * well inside that budget rather than letting Appwrite reject the page.
 */
const MAX_UNIT_SLUG_LENGTH = 100;

/**
 * Campus-agnostic URL slug for a department.
 *
 * "OSL Fadderullan" and "BRG Fadderullan" both yield "fadderullan" — the four
 * campus rows share one student-facing name, and `(slug, campus_id)` keeps them
 * distinct in the database.
 *
 * Built on `normalizeForCompare`, which already strips the OSL|BRG|TRD|STV
 * prefix and folds ø→o, æ→ae, å→a. Do not add a second normalizer.
 *
 * Capped at MAX_UNIT_SLUG_LENGTH so the derived page slug always fits
 * `pages.slug`; the trailing-dash trim runs again after the cut, because
 * slicing mid-word can leave one behind.
 */
export function unitSlug(name: string): string {
  const slug = normalizeForCompare(stripClosedSuffix(name))
    .replace(WHITESPACE_TO_DASH, "-")
    .replace(NON_SLUG_CHARS, "")
    .replace(REPEATED_DASH, "-")
    .replace(EDGE_DASH, "")
    .slice(0, MAX_UNIT_SLUG_LENGTH)
    .replace(EDGE_DASH, "");
  return slug || "unit";
}

/** Resolve a slug collision WITHIN one campus by suffixing -2, -3, … */
export function uniqueUnitSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  for (let suffix = 2; suffix < MAX_SLUG_ATTEMPTS; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not find an available unit slug for "${base}"`);
}

export interface ExistingDepartmentSlug {
  $id: string;
  campus_id: string;
  slug?: string | null;
}

export interface IncomingDepartment {
  $id: string;
  active: boolean;
  campusId: string;
  name: string;
}

/**
 * Decide which departments receive a slug on this sync run.
 *
 * Returns row `$id` → newly assigned slug. Rows already carrying a slug are
 * absent (a slug, once set, is never rewritten — a 24SO rename must not change
 * a live URL). Inactive rows are absent too: a closed "OSL Foo - nedlagt" would
 * otherwise take `foo` at campus 1 and push its live replacement to `foo-2`.
 */
export function assignUnitSlugs(
  existing: ExistingDepartmentSlug[],
  incoming: IncomingDepartment[]
): Map<string, string> {
  const slugged = new Set<string>();
  const takenByCampus = new Map<string, Set<string>>();

  for (const row of existing) {
    if (!row.slug) {
      continue;
    }
    slugged.add(row.$id);
    const taken = takenByCampus.get(row.campus_id) ?? new Set<string>();
    taken.add(row.slug);
    takenByCampus.set(row.campus_id, taken);
  }

  const assigned = new Map<string, string>();
  for (const department of incoming) {
    if (slugged.has(department.$id) || !department.active) {
      continue;
    }
    const taken = takenByCampus.get(department.campusId) ?? new Set<string>();
    const slug = uniqueUnitSlug(unitSlug(department.name), taken);
    taken.add(slug);
    takenByCampus.set(department.campusId, taken);
    assigned.set(department.$id, slug);
  }

  return assigned;
}

export interface LandingCtx {
  resolvedDepartmentIds: string[];
  roles: string[];
}

export type DepartmentsLanding =
  | { kind: "listing"; scopeIds?: string[] }
  | { kind: "redirect"; departmentId: string }
  | { kind: "forbidden" };

/**
 * What /departments should do for this caller.
 *
 * The `forbidden` case is not hypothetical: `resolveDepartmentIds` returns []
 * on lookup failure, and an Azure group with no matching Appwrite row resolves
 * to nothing. Passing the nav gate while owning no department must not fall
 * through to the full listing.
 */
export function resolveDepartmentsLanding(ctx: LandingCtx): DepartmentsLanding {
  if (
    ctx.roles.includes(ROLES.GLOBAL_ADMIN) ||
    ctx.roles.includes(ROLES.CAMPUS_ADMIN)
  ) {
    return { kind: "listing" };
  }
  const ids = ctx.resolvedDepartmentIds;
  if (ids.length === 0) {
    return { kind: "forbidden" };
  }
  if (ids.length === 1) {
    return { kind: "redirect", departmentId: ids[0] as string };
  }
  return { kind: "listing", scopeIds: ids };
}

export interface ManageCtx {
  managedCampusIds: string[];
  resolvedDepartmentIds: string[];
  roles: string[];
}

/** Grants are a union — a campus admin may also sit on a board elsewhere. */
export function canManageDepartment(
  ctx: ManageCtx,
  department: { $id: string; campus_id: string }
): boolean {
  if (ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    return true;
  }
  if (ctx.managedCampusIds.includes(department.campus_id)) {
    return true;
  }
  return ctx.resolvedDepartmentIds.includes(department.$id);
}
