"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { AuditLogs } from "@repo/api/types/appwrite";
import { requireAuth } from "@/lib/authorization";
import {
  emptyResult,
  type ListParams,
  type PaginatedResult,
  paginationQueries,
} from "@/lib/list-params";

export async function listActivityLog(
  params: ListParams & { resourceType?: string }
): Promise<PaginatedResult<AuditLogs>> {
  const ctx = await requireAuth();

  // Only campus admins and global admins can view the activity log
  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return emptyResult<AuditLogs>(params);
  }

  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.orderDesc("$createdAt"),
    ...paginationQueries(params),
  ];

  if (params.resourceType) {
    queries.push(Query.equal("resource_type", params.resourceType));
  }

  const response = await db.listRows<AuditLogs>("app", "audit_logs", queries);

  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
  };
}
