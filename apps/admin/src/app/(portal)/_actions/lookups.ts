"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import { redirect } from "next/navigation";
import { getUserAuthContext } from "@/lib/authorization";

async function requireAuth(): Promise<void> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
}

export async function listCampuses(): Promise<Campus[]> {
  await requireAuth();
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
  await requireAuth();
  const { db } = await createSessionClient();
  const response = await db.listRows<Departments>("app", "departments", [
    Query.equal("campus_id", campusId),
    Query.orderAsc("Name"),
    Query.limit(200),
  ]);
  return response.rows;
}
