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
