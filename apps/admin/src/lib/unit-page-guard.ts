import { isProjectPageSlug } from "@repo/shared/utils/project-units";
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
  // A `projects/<project>` page is bound the same way: a national project
  // page to its unit, a hub page to no department at all.
  if (!isAdminOwnedPageSlug(persisted.slug)) {
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

/**
 * Reserve `projects/<known project>`: the admin owns this namespace, exactly
 * as it owns `units/`. Only `createUnitPage` (a national project unit's page)
 * and `createProjectHubPage` (a multi-campus hub) may put a page there; both
 * call `savePageDraft` directly and never reach this guard.
 *
 * Same shape and same reasoning as `assertUnitPageNamespace`, checked on every
 * save: a create-only check is stepped around by saving an ordinary slug and
 * renaming it into the namespace. `isProjectPageSlug` trims and lowercases
 * because Appwrite matches slugs case-insensitively and storage trims them, so
 * `Projects/winter-games` would otherwise land on the reserved address while
 * passing this check.
 *
 * Returns an error message, or null when the slug is allowed.
 */
export function assertProjectPageNamespace(
  persistedSlug: string | null | undefined,
  nextSlug: string
): string | null {
  if (!isProjectPageSlug(nextSlug)) {
    return null;
  }
  if (persistedSlug === nextSlug) {
    return null;
  }
  return 'The "projects/" address space belongs to project pages. Open the unit under Departments and use "Create page", or ask BISO IT for a project hub page.';
}

/**
 * A hub page is a `projects/<project>` page with no department. No department
 * means no unit's members to scope it to, so only a global admin may save one
 * (a campus admin whose managed campus happens to match the row would
 * otherwise pass `assertWriteAccess`). A national project page is bound to its
 * unit and follows the ordinary department write rules instead.
 */
export function assertProjectHubWriteAccess(
  persisted: { department_id?: string | null; slug?: string | null },
  isGlobalAdmin: boolean
): string | null {
  if (!isProjectPageSlug(persisted.slug)) {
    return null;
  }
  if (persisted.department_id || isGlobalAdmin) {
    return null;
  }
  return "Only a global admin can edit a project hub page";
}

/**
 * Both rules for a `projects/` save in one call: the namespace is reserved
 * (see `assertProjectPageNamespace`), and a hub page is global-admin only.
 * The hub rule runs only for an existing row, after the caller's own access
 * check, so it cannot become an existence oracle.
 */
export function assertProjectPageSave({
  isGlobalAdmin,
  nextSlug,
  persisted,
}: {
  isGlobalAdmin: boolean;
  nextSlug: string;
  persisted: { department_id?: string | null; slug?: string | null } | null;
}): string | null {
  const namespaceError = assertProjectPageNamespace(
    persisted?.slug ?? null,
    nextSlug
  );
  if (namespaceError) {
    return namespaceError;
  }
  return persisted
    ? assertProjectHubWriteAccess(persisted, isGlobalAdmin)
    : null;
}

/** A page whose address is owned by the admin (`units/…` or `projects/<project>`). */
export function isAdminOwnedPageSlug(slug: string | null | undefined): boolean {
  return isUnitPageSlug(slug) || isProjectPageSlug(slug);
}
