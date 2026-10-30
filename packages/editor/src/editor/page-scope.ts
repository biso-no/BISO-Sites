import { slugifyAnchor } from "./operations";
import type { EditorDepartment, PageMeta } from "./types";

/** The name a page below a unit gets when its title gives none. */
const FALLBACK_PAGE_NAME = "side";

/**
 * Campus-then-department scoping for the page settings tab. A page belongs
 * to a campus first; the department list shows only that campus's
 * departments, so the two can never disagree.
 */

export function departmentsForCampus(
  departments: EditorDepartment[],
  campusId: string
): EditorDepartment[] {
  if (!campusId) {
    return [];
  }
  return departments.filter((department) => department.campusId === campusId);
}

/** The meta after picking a campus: a department off that campus is cleared. */
export function metaAfterCampusChange(
  meta: PageMeta,
  campusId: string,
  departments: EditorDepartment[]
): PageMeta {
  const keepsDepartment = departmentsForCampus(departments, campusId).some(
    (department) => department.id === meta.department
  );
  return {
    ...meta,
    campus: campusId,
    department: keepsDepartment ? meta.department : "",
  };
}

/**
 * The editable part of a page below a unit: what follows `<unitSlug>/` in its
 * slug, or "" when the slug isn't below that unit.
 */
export function unitPageName(slug: string, unitSlug: string): string {
  const prefix = `${unitSlug}/`;
  return slug.startsWith(prefix) ? slug.slice(prefix.length) : "";
}

/**
 * The meta after picking a department for a page held below its unit
 * (`units/<campus>/<unit>/<name>`): the name moves under the new unit, and a
 * page that isn't below a unit yet is named from its title. A department with
 * no unit address leaves the slug alone; the save then refuses it.
 */
export function metaAfterUnitDepartmentChange(
  meta: PageMeta,
  departmentId: string,
  departments: EditorDepartment[]
): PageMeta {
  const unitSlug = departments.find((d) => d.id === departmentId)?.unitSlug;
  if (!unitSlug) {
    return { ...meta, department: departmentId };
  }
  const previousUnit = departments.find(
    (d) => d.id === meta.department
  )?.unitSlug;
  const name =
    (previousUnit ? unitPageName(meta.slug, previousUnit) : "") ||
    slugifyAnchor(meta.title) ||
    FALLBACK_PAGE_NAME;
  return { ...meta, department: departmentId, slug: `${unitSlug}/${name}` };
}
