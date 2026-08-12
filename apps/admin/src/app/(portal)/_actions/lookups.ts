"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
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
