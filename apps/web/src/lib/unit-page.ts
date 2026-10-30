import type { Departments } from "@repo/api/types/appwrite";
import { normalizePageDoc } from "@repo/editor/serialize";
import type { PageDoc } from "@repo/editor/types";
import {
  isHubProject,
  PROJECT_UNIT_SLUGS,
  type ProjectSlug,
  projectPageSlug,
  projectSlugForUnit,
} from "@repo/shared/utils/project-units";
import {
  campusSegmentToId,
  unitCanonicalPath,
} from "@repo/shared/utils/unit-urls";
import {
  cachedDepartmentBySlugAndCampus,
  type cachedPublishedPage,
} from "@/lib/data/public-content";

/**
 * Shared by the unit page and the form endpoint, so the endpoint accepts
 * exactly the pages the site renders for a unit.
 */

/**
 * The slug is the binding between a department and its custom page, but the
 * slug is reusable, so a page found at the canonical slug is only genuinely
 * this department's page if its `department_id` says so. A null
 * `department_id` must never match: it means "no department", not "any".
 */
export function pageBelongsToDepartment(
  pageDepartmentId: string | null | undefined,
  departmentId: string
): boolean {
  return pageDepartmentId != null && pageDepartmentId === departmentId;
}

type PageLookupResult = Awaited<ReturnType<typeof cachedPublishedPage>>;

/** A lookup that passed `publishedUnitPage`, its document normalized (not yet sanitized). */
export interface PublishedUnitPage {
  doc: PageDoc;
  translation: NonNullable<PageLookupResult>["translation"];
}

/**
 * Whether a normalized document has anything to show. An old flat (v1)
 * document normalizes to zero sections and no header; a page with neither is
 * treated as no page, and the route shows its coded default instead (D2). A
 * header alone is content.
 */
export function hasPageContent(doc: PageDoc): boolean {
  return doc.sections.length > 0 || doc.header !== undefined;
}

/**
 * The single predicate for "this lookup is genuinely this department's
 * PUBLISHED custom page": a published translation, a document to render, and
 * ownership. The page body, generateMetadata and the form endpoint MUST share
 * it, or they can disagree about what the page is.
 *
 * `pages` and `page_translations` rows carry their own read permissions, so a guest
 * client can only read rows that were published; `getPage` returns the translation
 * even without a published document. Checking ownership alone would leak a
 * draft's title into `<head>` while the body falls back to the default view.
 *
 * A document with no content is no page: see {@link hasPageContent}.
 */
export function publishedUnitPage(
  pageResult: PageLookupResult,
  departmentId: string
): PublishedUnitPage | null {
  if (
    !(
      pageResult?.translation?.is_published &&
      pageResult.doc &&
      pageBelongsToDepartment(pageResult.row.department_id, departmentId)
    )
  ) {
    return null;
  }
  // Normalized, not sanitized: stored text-block HTML is untrusted, so a
  // caller that RENDERS the document sanitizes it (the sanitizer is limited to
  // server pages and actions); the structure checked here is unaffected.
  const doc = normalizePageDoc(pageResult.doc as PageDoc);
  return hasPageContent(doc)
    ? { doc, translation: pageResult.translation }
    : null;
}

/**
 * The department behind a `/units/<campus>/<slug>` URL, cookie-independent,
 * with its canonical path built from the resolved ids rather than the URL
 * text (so `/units/OSLO/Fadderullan` is not a second URL for the same page).
 */
/**
 * A department's page below its unit (`units/<campus>/<unit>/<name>`), as the
 * site serves it: the row stored at exactly `slug` (the lookup also matches
 * case and accent variants, which the admin never writes), published, and
 * bound to the unit's department — `publishedUnitPage`'s rule.
 */
export function publishedUnitSubPage(
  pageResult: PageLookupResult,
  slug: string,
  departmentId: string
): PublishedUnitPage | null {
  return pageResult?.row.slug === slug
    ? publishedUnitPage(pageResult, departmentId)
    : null;
}

export async function findCanonicalUnit(
  campusSegment: string,
  slug: string
): Promise<{ canonical: string; department: Departments } | null> {
  const campusId = campusSegmentToId(campusSegment);
  if (!campusId) {
    return null;
  }
  const department = await cachedDepartmentBySlugAndCampus(slug, campusId);
  if (!department) {
    return null;
  }
  const canonical = unitCanonicalPath({ campusId, slug: department.slug });
  return canonical ? { canonical, department } : null;
}

const NATIONAL_CAMPUS_ID = "5";

/**
 * Whether a page found at `projects/<project>` is genuinely that project's:
 * its stored slug, trimmed and lowercased, is EXACTLY the project address
 * (Appwrite's collation also folds accents, so `projécts/…` can match the
 * lookup), and its department fits. A hub project's page has no department; a
 * national project's page is bound to that project's national unit (campus "5",
 * slug from PROJECT_UNIT_SLUGS). The admin refuses to write anything else
 * there, but a stray or legacy row must not be served on trust. Mirrors
 * `publishedUnitPage`'s ownership rule.
 */
export async function projectPageIsGenuine(
  pageResult: PageLookupResult,
  project: ProjectSlug
): Promise<boolean> {
  const row = pageResult?.row;
  if (!row || row.slug?.trim().toLowerCase() !== projectPageSlug(project)) {
    return false;
  }
  if (isHubProject(project)) {
    return row.department_id == null;
  }
  if (row.department_id == null) {
    return false;
  }
  const unit = await cachedDepartmentBySlugAndCampus(
    PROJECT_UNIT_SLUGS[project],
    NATIONAL_CAMPUS_ID
  ).catch(() => null);
  return unit?.$id === row.department_id;
}

/**
 * Whether `/projects/<project>` serves this lookup instead of its coded hub:
 * a published page with something to show ({@link hasPageContent}, the rule a
 * unit's page follows) that is genuinely the project's
 * ({@link projectPageIsGenuine}). The project route, the C3 unit redirect and
 * the sitemap all decide with it, so a unit URL redirects, and leaves the
 * sitemap, only for a project page that actually renders.
 */
export async function isServableProjectPage(
  pageResult: PageLookupResult | null | undefined,
  project: ProjectSlug
): Promise<boolean> {
  if (
    !(
      pageResult?.translation?.is_published &&
      pageResult.doc &&
      hasPageContent(normalizePageDoc(pageResult.doc as PageDoc))
    )
  ) {
    return false;
  }
  return await projectPageIsGenuine(pageResult, project);
}

/**
 * The national project whose own page takes over this unit's URL (C3), or
 * null. Only a project's campus-5 unit, and only a national project: a hub
 * project's page stands beside its campus units, it replaces none of them.
 */
export function nationalProjectForUnit(unit: {
  campus_id?: string | null;
  slug?: string | null;
}): ProjectSlug | null {
  if (unit.campus_id !== NATIONAL_CAMPUS_ID) {
    return null;
  }
  const project = projectSlugForUnit(unit.slug);
  return project && !isHubProject(project) ? project : null;
}
