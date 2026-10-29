"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Departments, SalesTypes } from "@repo/api/types/appwrite";
import { requireAuth } from "@/lib/authorization";
import { isHrDepartment } from "@/lib/recruitment";

const HR_DEPARTMENT_NAMES = ["HR", "HR Unit", "HRUnit"];

export async function listCampuses(): Promise<Campus[]> {
  await requireAuth();
  const { db } = await createAdminClient();
  const response = await db.listRows<Campus>("app", "campus", [
    Query.orderAsc("name"),
    Query.limit(50),
  ]);
  return response.rows;
}

export async function listDepartmentsForCampus(
  campusId: string
): Promise<Departments[]> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const response = await db.listRows<Departments>("app", "departments", [
    Query.equal("campus_id", campusId),
    Query.orderAsc("Name"),
    Query.limit(200),
  ]);
  const isAdmin =
    ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin");
  if (isAdmin) {
    return response.rows;
  }
  // Department authors may only ever assign their own departments, so the
  // lookup never reveals more than they can use.
  return response.rows.filter((row) =>
    ctx.resolvedDepartmentIds.includes(row.$id)
  );
}

/**
 * Departments selectable in the job recruitment studio for `campusId`.
 *
 * - Global admins and National HR (`hradmin`) can select any department in any
 *   campus.
 * - Campus HR (`hr` + a campus team) and campus admins can select any
 *   department in their allowed campus(es).
 * - Because HR only exists as a National department row in Appwrite, it is
 *   always included as an option alongside the campus's own departments.
 */
export async function listJobDepartmentsForCampus(
  campusId: string
): Promise<Departments[]> {
  if (!campusId) {
    return [];
  }
  const ctx = await requireAuth();
  const canManageAnyCampus =
    ctx.roles.includes("globaladmin") ||
    ctx.roles.includes("hradmin") ||
    (ctx.roles.includes("hr") &&
      ctx.campusNames.includes("National"));
  const canManageCampus =
    canManageAnyCampus ||
    ((ctx.roles.includes("hr") ||
      ctx.roles.includes("campusadmin")) &&
      (ctx.resolvedCampusIds.includes(campusId) ||
        ctx.managedCampusIds.includes(campusId)));

  if (!canManageCampus) {
    return [];
  }

  const { db } = await createAdminClient();
  const hrNames = Array.from(
    new Set([
      ...HR_DEPARTMENT_NAMES,
      ...ctx.departmentNames.filter((name) => isHrDepartment([name])),
    ])
  );
  const response = await db.listRows<Departments>("app", "departments", [
    Query.or([
      Query.equal("campus_id", campusId),
      Query.equal("Name", hrNames),
    ]),
    Query.orderAsc("Name"),
    Query.limit(200),
  ]);
  return response.rows;
}

export interface SalesTypeOption {
  accountNumber: number;
  active: boolean;
  id: string;
  labelEn: string;
  labelNo: string;
}

/**
 * Active sales types for the product editor, in the order finance set. Pass
 * the product's saved sales type to include it even when it has since been
 * deactivated, so the editor can still show its label; other inactive types
 * are never offered.
 */
export async function listSalesTypeOptions(
  currentSalesTypeId?: string | null
): Promise<SalesTypeOption[]> {
  await requireAuth();
  const { db } = await createAdminClient();
  const activeOnly = Query.equal("active", true);
  const response = await db.listRows<SalesTypes>("app", "sales_types", [
    currentSalesTypeId
      ? Query.or([activeOnly, Query.equal("$id", currentSalesTypeId)])
      : activeOnly,
    Query.orderAsc("sort_order"),
    Query.limit(100),
  ]);
  return response.rows.map((row) => ({
    accountNumber: row.account_number,
    active: row.active !== false,
    id: row.$id,
    labelEn: row.label_en,
    labelNo: row.label_no,
  }));
}
