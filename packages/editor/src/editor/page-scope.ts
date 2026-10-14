import type { EditorDepartment, PageMeta } from "./types";

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
