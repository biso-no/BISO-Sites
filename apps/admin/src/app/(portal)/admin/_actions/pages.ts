"use server";

import { redirect } from "next/navigation";
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  getUserAuthContext,
  type UserAuthContext,
} from "@/lib/authorization";
import type { Pages } from "@repo/api/types/appwrite";

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) redirect("/auth/login");
  return ctx;
}

export async function listPages(opts?: { status?: string; campusId?: string }) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.limit(100),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  // Scope by campus if not global admin
  if (!ctx.roles.includes("globaladmin")) {
    if (ctx.managedCampusIds.length > 0) {
      queries.push(Query.equal("campus_id", ctx.managedCampusIds));
    } else if (ctx.resolvedCampusIds.length > 0) {
      queries.push(Query.equal("campus_id", ctx.resolvedCampusIds));
    }
  }

  const response = await db.listRows<Pages>("app", "pages", queries);
  return response.rows;
}

export async function getDashboardStats() {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const scopeFilter: string[] = [];
  if (!ctx.roles.includes("globaladmin")) {
    if (ctx.managedCampusIds.length > 0) {
      scopeFilter.push(Query.equal("campus_id", ctx.managedCampusIds));
    } else if (ctx.resolvedCampusIds.length > 0) {
      scopeFilter.push(Query.equal("campus_id", ctx.resolvedCampusIds));
    }
  }

  const [jobsRes, eventsRes, newsRes, draftsRes] = await Promise.allSettled([
    db.listRows("app", "jobs", [
      Query.equal("status", "published"),
      Query.limit(1),
      ...scopeFilter,
    ]),
    db.listRows("app", "events", [
      Query.equal("status", "published"),
      Query.limit(1),
      ...scopeFilter,
    ]),
    db.listRows("app", "news", [
      Query.equal("status", "published"),
      Query.limit(1),
      ...scopeFilter,
    ]),
    db.listRows("app", "jobs", [
      Query.equal("status", "draft"),
      Query.limit(1),
      ...scopeFilter,
    ]),
  ]);

  return {
    jobs:
      jobsRes.status === "fulfilled" ? jobsRes.value.total ?? 0 : 0,
    events:
      eventsRes.status === "fulfilled" ? eventsRes.value.total ?? 0 : 0,
    news:
      newsRes.status === "fulfilled" ? newsRes.value.total ?? 0 : 0,
    drafts:
      draftsRes.status === "fulfilled" ? draftsRes.value.total ?? 0 : 0,
  };
}
