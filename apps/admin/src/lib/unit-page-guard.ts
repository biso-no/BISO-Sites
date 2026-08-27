import { isUnitPageSlug } from "@repo/shared/utils/unit-urls";

/**
 * A unit page's slug IS its binding to a department: the public routes resolve
 * a department, build `units/<campus>/<slug>`, and look that page up. Changing
 * either field would orphan the page — reachable from nowhere, and invisible
 * in the department's admin view.
 *
 * The editor renders both fields read-only, but THIS is the enforcement; the
 * UI lock is convenience. Returns an error message, or null when allowed.
 */
export function assertUnitPageBindingUnchanged(
  persisted: { department_id?: string | null; slug?: string | null },
  next: { department: string; slug: string }
): string | null {
  if (!isUnitPageSlug(persisted.slug)) {
    return null;
  }
  if (next.slug !== persisted.slug) {
    return "A unit page's slug is managed by its department and cannot change";
  }
  if ((persisted.department_id ?? "") !== next.department) {
    return "A unit page's department is managed by its department and cannot change";
  }
  return null;
}

/**
 * Reserve the `units/` slug namespace against page CREATION.
 *
 * `assertUnitPageBindingUnchanged` can only defend a slug that is already
 * persisted, so on its own it leaves the namespace unclaimed: any portal user
 * with `portal.pages` could open /pages/new, type `units/oslo/fadderullan`,
 * keep their OWN department (which is all `assertContentOwnership` checks) and
 * publish another department's URL out from under it — permanently, because
 * `createUnitPage` idempotently hands back whatever page already sits at that
 * slug.
 *
 * `createUnitPage` is the only legitimate creator of a unit page and it calls
 * `savePageDraft` directly, so this rejection never fires on the real flow.
 * Returns an error message, or null when the creation is allowed.
 */
export function assertUnitPageCreationAllowed(
  slug: string | null | undefined
): string | null {
  if (!isUnitPageSlug(slug)) {
    return null;
  }
  return 'A unit page is created from its department page, not here. Open the department under Departments and use "Create page".';
}
