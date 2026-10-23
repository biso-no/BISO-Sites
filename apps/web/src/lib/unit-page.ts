import type { Departments } from "@repo/api/types/appwrite";
import { normalizePageDoc } from "@repo/editor/serialize";
import type { PageDoc } from "@repo/editor/types";
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
 * The single predicate for "this lookup is genuinely this department's
 * PUBLISHED custom page": a published translation, a document to render, and
 * ownership. The page body, generateMetadata and the form endpoint MUST share
 * it, or they can disagree about what the page is.
 *
 * `pages` and `page_translations` have table-level `read("any")`, so a guest
 * client can read an unpublished draft row; `getPage` returns the translation
 * even without a published document. Checking ownership alone would leak a
 * draft's title into `<head>` while the body falls back to the default view.
 *
 * An old flat (v1) document normalizes to zero sections and no header; a page
 * with neither is treated as no page (D2). A header alone is content.
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
  return doc.sections.length > 0 || doc.header !== undefined
    ? { doc, translation: pageResult.translation }
    : null;
}

/**
 * The department behind a `/units/<campus>/<slug>` URL, cookie-independent,
 * with its canonical path built from the resolved ids rather than the URL
 * text (so `/units/OSLO/Fadderullan` is not a second URL for the same page).
 */
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
