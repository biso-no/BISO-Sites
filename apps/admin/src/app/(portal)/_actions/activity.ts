"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { AuditLogs } from "@repo/api/types/appwrite";
import { requireAuth } from "@/lib/authorization";

export async function listActivityLog(opts?: {
  search?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
}) {
  const ctx = await requireAuth();

  // Only campus admins and global admins can view the activity log
  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return [];
  }

  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.orderDesc("$createdAt"),
    Query.limit(opts?.limit ?? 50),
  ];

  if (opts?.offset) {
    queries.push(Query.offset(opts.offset));
  }

  if (opts?.resourceType) {
    queries.push(Query.equal("resource_type", opts.resourceType));
  }

  const response = await db.listRows<AuditLogs>("app", "audit_logs", queries);
  return response.rows;
}
