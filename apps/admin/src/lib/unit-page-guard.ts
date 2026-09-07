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
 * Reserve the `units/` slug namespace: only `createUnitPage` may put a page
 * there, and only at its own department's address.
 *
 * Checked on EVERY save, not just creates. A create-only check is trivially
 * stepped around: save a page as `about/junk`, then edit the slug to
 * `units/oslo/fadderullan` and save again. On that second save
 * `assertUnitPageBindingUnchanged` returns null immediately (the PERSISTED
 * slug is ordinary, so it never inspects the incoming one), `savePageDraft`
 * writes the slug verbatim because `resolveUniquePageSlug` only runs for a
 * create, and the editor's `lockedMeta` never engaged because it too keys off
 * the persisted slug. The row lands on the victim department's public URL and
 * locks the victim out of creating its own page.
 *
 * The rule is "the incoming slug is a unit slug AND is not the exact slug this
 * row already carries". That covers both a create (nothing persisted, so any
 * unit slug is a claim) and a rename into the namespace, while leaving a
 * genuine unit page free to save itself normally. `createUnitPage` calls
 * `savePageDraft` directly and never reaches this guard.
 *
 * Renaming a unit page OUT of the namespace passes here and is caught by
 * `assertUnitPageBindingUnchanged` instead — the two rules are complementary,
 * not overlapping.
 *
 * Returns an error message, or null when the slug is allowed.
 */
export function assertUnitPageNamespace(
  persistedSlug: string | null | undefined,
  nextSlug: string
): string | null {
  if (!isUnitPageSlug(nextSlug)) {
    return null;
  }
  if (persistedSlug === nextSlug) {
    return null;
  }
  return 'The "units/" address space belongs to department pages. Open the department under Departments and use "Create page" instead.';
}
