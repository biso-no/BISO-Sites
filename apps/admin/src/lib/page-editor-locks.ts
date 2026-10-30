import type { LockedPageMeta } from "@repo/editor/types";
import { isProjectNamespaceSlug } from "@repo/shared/utils/project-units";
import {
  isUnitPageSlug,
  parseUnitSubPageSlug,
} from "@repo/shared/utils/unit-urls";

/**
 * Which page settings the editor holds for this page. The UI lock is
 * convenience; `savePageEditorDoc` enforces each rule.
 *
 * - A sub-page (`units/<campus>/<unit>/<name>`) belongs to its department and
 *   campus; only its name is edited.
 * - A unit page's or project page's slug IS its binding (see the unit pages
 *   spec): editing any of slug, department or campus would orphan it.
 * - A department user's pages live below their unit: a new page is held
 *   there, and an older page elsewhere keeps its address.
 * - Otherwise the campus is held only when the user can't choose one.
 */
export function pageEditorLocks({
  campusLocked,
  departmentUser,
  slug,
}: {
  /** The user may not choose a campus. */
  campusLocked: boolean;
  /** Neither a global nor a campus admin. */
  departmentUser: boolean;
  /** The stored page's slug; null for a new page. */
  slug: string | null;
}): LockedPageMeta | undefined {
  if (parseUnitSubPageSlug(slug)) {
    return { campus: true, department: true, slugUnderUnit: true };
  }
  if (isUnitPageSlug(slug) || isProjectNamespaceSlug(slug)) {
    return { campus: true, department: true, slug: true };
  }
  if (departmentUser) {
    return slug === null
      ? { campus: true, slugUnderUnit: true }
      : { campus: true, slug: true };
  }
  return campusLocked ? { campus: true } : undefined;
}
