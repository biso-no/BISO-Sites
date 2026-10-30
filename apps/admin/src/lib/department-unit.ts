import { unitPageSlug } from "@repo/shared/utils/unit-urls";
import { isPublicUnit } from "@repo/shared/utils/unit-visibility";

/**
 * The unit address a department's pages sit below (`units/<campus>/<slug>`),
 * or null when the site wouldn't serve them there. The public lookup
 * (`cachedDepartmentBySlugAndCampus`) wants a slug, `active: true` (a null
 * value doesn't count) and a public unit (`isPublicUnit`), so a page below
 * any other department would 404 forever.
 */
export function departmentUnitSlug(row: {
  active?: boolean | null;
  campus_id?: string | null;
  Name?: string | null;
  slug?: string | null;
}): string | null {
  if (row.active !== true || !isPublicUnit(row)) {
    return null;
  }
  return unitPageSlug({ campusId: row.campus_id, slug: row.slug });
}
