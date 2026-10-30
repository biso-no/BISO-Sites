import { isProjectNamespaceSlug } from "@repo/shared/utils/project-units";
import {
  isUnitPageSlug,
  parseUnitSubPageSlug,
} from "@repo/shared/utils/unit-urls";

/** Whether `slug` is exactly `<unitSlug>/<name>` (see `parseUnitSubPageSlug`). */
function isSubPageOf(slug: string, unitSlug: string | null | undefined) {
  return Boolean(unitSlug) && parseUnitSubPageSlug(slug)?.unitSlug === unitSlug;
}

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
  // A sub-page's name may change; the unit it sits under may not.
  const subPage = parseUnitSubPageSlug(persisted.slug);
  const renamedWithinUnit =
    subPage !== null && isSubPageOf(next.slug, subPage.unitSlug);
  if (next.slug !== persisted.slug && !renamedWithinUnit) {
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
 * One more address is open: a department's sub-page,
 * `<unitSlug>/<name>` exactly (`parseUnitSubPageSlug`), where `unitSlug` is
 * the unit address of the department the page is saved under. The caller
 * derives it from the department row, never from the request.
 *
 * Returns an error message, or null when the slug is allowed.
 */
export function assertUnitPageNamespace(
  persistedSlug: string | null | undefined,
  nextSlug: string,
  unitSlug?: string | null
): string | null {
  if (!isUnitPageSlug(nextSlug)) {
    return null;
  }
  if (persistedSlug === nextSlug || isSubPageOf(nextSlug, unitSlug)) {
    return null;
  }
  return 'The "units/" address space belongs to department pages. Open the department under Departments and use "Create page" instead.';
}

/**
 * A department user's pages live under their unit: a new page, or a page
 * whose address changes, must be `<unitSlug>/<name>`, where `unitSlug` is the
 * unit address of the page's department. A page that keeps its address is
 * left alone, so pages made before this rule can still be saved.
 *
 * Returns an error message, or null when the address is allowed.
 */
export function assertDepartmentUserAddress({
  nextSlug,
  persistedSlug,
  unitSlug,
}: {
  nextSlug: string;
  persistedSlug: string | null | undefined;
  unitSlug: string | null;
}): string | null {
  if (persistedSlug === nextSlug || isSubPageOf(nextSlug, unitSlug)) {
    return null;
  }
  if (!unitSlug) {
    return "This department has no page on biso.no, so it can't have pages of its own. Ask BISO IT if it should.";
  }
  return `Your department's pages live under ${unitSlug}/ — give the page a name after that.`;
}

/**
 * Reserve `projects/<known project>`: the admin owns this namespace, exactly
 * as it owns `units/`. Only `createUnitPage` (a national project unit's page)
 * and `createProjectPage` (a multi-campus hub) may put a page there; both
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
  if (!isProjectNamespaceSlug(nextSlug)) {
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
  if (!isProjectHubPage(persisted) || isGlobalAdmin) {
    return null;
  }
  return "Only a global admin can edit a project hub page";
}

/**
 * A hub page: anywhere in the `projects/` namespace with no department. The
 * whole namespace counts, not just known projects, so a legacy
 * `projects/<anything>` row nobody owns is global-admin territory too.
 */
export function isProjectHubPage(
  persisted: { department_id?: string | null; slug?: string | null } | null
): boolean {
  return isProjectNamespaceSlug(persisted?.slug) && !persisted?.department_id;
}

/**
 * Throwing form of `assertProjectHubWriteAccess` for the actions that throw
 * (publish, unpublish, archive). Runs after the caller's own access check.
 */
export function requireProjectHubAccess(
  persisted: { department_id?: string | null; slug?: string | null },
  roles: readonly string[]
): void {
  const error = assertProjectHubWriteAccess(
    persisted,
    roles.includes("globaladmin")
  );
  if (error) {
    throw new Error(error);
  }
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
  return isUnitPageSlug(slug) || isProjectNamespaceSlug(slug);
}
