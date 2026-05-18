"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";

export async function listCampuses(): Promise<Campus[]> {
  const { db } = await createSessionClient();
  const response = await db.listRows<Campus>("app", "campus", [
    Query.orderAsc("name"),
    Query.limit(50),
  ]);
  return response.rows;
}

export async function listDepartmentsForCampus(
  campusId: string
): Promise<Departments[]> {
  const { db } = await createSessionClient();
  const response = await db.listRows<Departments>("app", "departments", [
    Query.equal("campus_id", campusId),
    Query.orderAsc("Name"),
    Query.limit(200),
  ]);
  return response.rows;
}
