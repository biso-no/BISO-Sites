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
  // `params.q` is intentionally ignored: search is not implemented for the
  // activity log. `resourceType` is the only filter this surface supports.
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

/**
 * Bounded aggregate read for the dashboard chart and recent-activity strip.
 * Deliberately separate from listActivityLog: those surfaces need a fixed
 * window, not a page, and must not be constrained by PageSize.
 *
 * Escape-hatch convention: prefer this caller-parameterised `(limit: number)`
 * shape for a "give me everything" read used by more than one consumer.
 * Reserve a hardcoded limit (see `listAllDepartments` in `departments.ts`) for
 * a full-list read with a single known consumer.
 */
export async function listRecentActivity(limit: number): Promise<AuditLogs[]> {
  const ctx = await requireAuth();

  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return [];
  }

  const { db } = await createAdminClient();
  const response = await db.listRows<AuditLogs>("app", "audit_logs", [
    Query.orderDesc("$createdAt"),
    Query.limit(limit),
  ]);

  return response.rows;
}
