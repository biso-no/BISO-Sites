"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Departments, SalesTypes } from "@repo/api/types/appwrite";
import { requireAuth } from "@/lib/authorization";

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
