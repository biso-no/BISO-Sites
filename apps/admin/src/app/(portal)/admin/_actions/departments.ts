"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

export async function listDepartments(opts?: {
  campusId?: string;
  search?: string;
}) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const queries: string[] = [Query.orderAsc("Name"), Query.limit(200)];

  if (opts?.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
  } else if (
    ctx.managedCampusIds.length > 0 &&
    !ctx.roles.includes("globaladmin")
  ) {
    queries.push(Query.equal("campus_id", ctx.managedCampusIds));
  }

  if (opts?.search) {
    queries.push(Query.search("Name", opts.search));
  }

  const response = await db.listRows<Departments>(
    "app",
    "departments",
    queries
  );
  return response.rows;
}

async function getDepartment(id: string) {
  await requireAuth();
  const { db } = await createSessionClient();

  const response = await db.listRows<Departments>("app", "departments", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  return response.rows[0] ?? null;
}

export async function listCampuses() {
  await requireAuth();
  const { db } = await createSessionClient();
  const response = await db.listRows<Campus>("app", "campus", [
    Query.orderAsc("name"),
    Query.limit(50),
  ]);
  return response.rows;
}
