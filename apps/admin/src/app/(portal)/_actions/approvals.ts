"use server";

/**
 * Approval workflow server actions.
 *
 * NOTE: Requires the `approval_requests` collection in Appwrite with the
 * following attributes:
 *   requester_id (string, required)
 *   requester_email (string, required)
 *   action (string, required)            — e.g. "jobs.publish"
 *   resource_type (string, required)     — e.g. "job"
 *   resource_id (string, nullable)       — existing entity $id if applicable
 *   payload (string, required)           — JSON-serialised mutation payload
 *   campus_id (string, nullable)
 *   department_id (string, nullable)
 *   approver_team_id (string, required)  — Appwrite team ID or slug
 *   status (enum: pending|approved|rejected|cancelled)
 *   decided_by (string, nullable)
 *   decided_at (datetime, nullable)
 *   reason (string, nullable)
 *
 * $permissions (suggested):
 *   read(team:<approver_team_id>), update(team:<approver_team_id>),
 *   read(team:sg-app-dept-operationsunit), update(team:sg-app-dept-operationsunit),
 *   read(user:<requester_id>)
 *
 * Create the collection and regenerate packages/api/types/appwrite.ts before
 * using these actions in production.
 */

import { ID, type Models, Permission, Query, Role } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import {
  emptyResult,
  type ListParams,
  type PaginatedResult,
  paginationQueries,
} from "@/lib/list-params";
import { assertPublishAccess } from "@/lib/utils/authorization";
import {
  type ApprovalPublishPlan,
  buildApprovalPublishPlan,
} from "./approval-execution";
import { logAuditEvent } from "./audit-log";
import { publishEvent } from "./events";

const DATABASE_ID = "app";
const TABLE = "approval_requests";
const OPERATIONS_UNIT_TEAM_ID = "sg-app-dept-operationsunit";
type GenericRow = Models.Row & Record<string, unknown>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApprovalRequest {
  $createdAt: string;
  $databaseId: string;
  $id: string;
  $permissions: string[];
  $sequence: string;
  $tableId: string;
  $updatedAt: string;
  action: string;
  approver_team_id: string;
  campus_id: string | null;
  decided_at: string | null;
  decided_by: string | null;
  department_id: string | null;
  payload: string;
  reason: string | null;
  requester_email: string;
  requester_id: string;
  resource_id: string | null;
  resource_type: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
}

export interface CreateApprovalRequestInput {
  action: string;
  approverTeamId: string;
  campusId?: string;
  departmentId?: string;
  payload: Record<string, unknown>;
  resourceId?: string;
  resourceType: string;
}

// ---------------------------------------------------------------------------
// Create an approval request
// ---------------------------------------------------------------------------

export async function createApprovalRequest(
  input: CreateApprovalRequestInput
): Promise<{ data: string } | { error: string }> {
  const ctx = await requireAuth();

  try {
    const { db } = await createAdminClient();
    const id = ID.unique();

    await db.createRow(
      DATABASE_ID,
      TABLE,
      id,
      {
        requester_id: ctx.userId,
        requester_email: ctx.email ?? "",
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId ?? null,
        payload: JSON.stringify(input.payload),
        campus_id: input.campusId ?? null,
        department_id: input.departmentId ?? null,
        approver_team_id: input.approverTeamId,
        status: "pending",
        decided_by: null,
        decided_at: null,
        reason: null,
      },
      [
        Permission.read(Role.team(input.approverTeamId)),
        Permission.update(Role.team(input.approverTeamId)),
        Permission.read(Role.team(OPERATIONS_UNIT_TEAM_ID)),
        Permission.update(Role.team(OPERATIONS_UNIT_TEAM_ID)),
        Permission.read(Role.user(ctx.userId)),
      ]
    );

    await logAuditEvent(ctx, "approval.request.create", {
      resourceId: id,
      resourceType: input.resourceType,
      payload: {
        action: input.action,
        approverTeamId: input.approverTeamId,
      },
    });

    revalidatePath("/inbox/approvals");
    return { data: id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create request",
    };
  }
}

// ---------------------------------------------------------------------------
// List pending approvals for the current user's approver teams
// ---------------------------------------------------------------------------

export async function listPendingApprovals(
  // `params.q` is intentionally ignored: search is not implemented for this
  // surface.
  params: ListParams
): Promise<{ data: PaginatedResult<ApprovalRequest> } | { error: string }> {
  const ctx = await requireAuth();

  try {
    const { db } = await createSessionClient();

    // The session client uses row-level permissions, so only rows the user
    // can read (where they are in the approver team) will be returned. On top
    // of that, honor the global-admin campus switcher: when a global admin has
    // scoped themselves to a campus, only show that campus's approvals.
    const queries: string[] = [
      Query.equal("status", "pending"),
      Query.orderDesc("$createdAt"),
      ...paginationQueries(params),
    ];
    if (ctx.activeCampusId) {
      queries.push(Query.equal("campus_id", [ctx.activeCampusId]));
    }
    const result = await db.listRows<ApprovalRequest>(
      DATABASE_ID,
      TABLE,
      queries
    );

    return {
      data: {
        rows: result.rows,
        total: result.total,
        page: params.page,
        size: params.size,
      },
    };
  } catch (_error) {
    // If the table doesn't exist yet, return empty list gracefully
    return { data: emptyResult<ApprovalRequest>(params) };
  }
}

// ---------------------------------------------------------------------------
// Approve a request
// ---------------------------------------------------------------------------

export async function approveRequest(
  requestId: string
): Promise<{ data: string } | { error: string }> {
  const ctx = await requireAuth();

  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return {
      error: "Forbidden: only campus/global admins can approve requests",
    };
  }

  try {
    // Use session client for getRow so Appwrite row security prevents a
    // campus admin from approving requests scoped to another team.
    const { db: sessionDb } = await createSessionClient();
    const request = await sessionDb.getRow<ApprovalRequest>(
      DATABASE_ID,
      TABLE,
      requestId
    );
    if (!request) {
      return { error: "Request not found" };
    }
    if (request.status !== "pending") {
      return { error: `Request is already ${request.status}` };
    }

    const executionPlan = buildApprovalPublishPlan(request);
    await executeApprovalPublish(executionPlan, sessionDb, ctx);

    const { db } = await createAdminClient();
    await db.updateRow(DATABASE_ID, TABLE, requestId, {
      status: "approved",
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
    });

    await logAuditEvent(ctx, "approval.request.approve", {
      resourceId: requestId,
      resourceType: request.resource_type,
      payload: {
        action: request.action,
        executedResourceId: executionPlan.resourceId,
        executedTable: executionPlan.table,
        requesterId: request.requester_id,
      },
    });

    revalidatePath("/inbox/approvals");
    return { data: requestId };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Approval failed",
    };
  }
}

async function executeApprovalPublish(
  plan: ApprovalPublishPlan,
  sessionDb: Awaited<ReturnType<typeof createSessionClient>>["db"],
  ctx: Awaited<ReturnType<typeof requireAuth>>
) {
  if (plan.domain === "events") {
    const result = await publishEvent(plan.resourceId);
    if ("error" in result) {
      throw new Error(result.error);
    }
    return;
  }

  const row = await sessionDb.getRow<GenericRow>(
    DATABASE_ID,
    plan.table,
    plan.resourceId
  );
  const campusId =
    typeof row.campus_id === "string" && row.campus_id.length > 0
      ? row.campus_id
      : null;

  assertPublishAccess(ctx, campusId);
  await sessionDb.updateRow(DATABASE_ID, plan.table, plan.resourceId, {
    status: "published",
  });

  revalidateApprovalPublishPaths(plan);
}

function revalidateApprovalPublishPaths(plan: ApprovalPublishPlan) {
  for (const path of plan.paths) {
    revalidatePath(path);
    if (path !== "/") {
      revalidatePath(`${path}/${plan.resourceId}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Reject a request
// ---------------------------------------------------------------------------

export async function rejectRequest(
  requestId: string,
  reason: string
): Promise<{ data: string } | { error: string }> {
  const ctx = await requireAuth();

  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return {
      error: "Forbidden: only campus/global admins can reject requests",
    };
  }

  try {
    const { db: sessionDb } = await createSessionClient();
    const request = await sessionDb.getRow<ApprovalRequest>(
      DATABASE_ID,
      TABLE,
      requestId
    );
    if (!request) {
      return { error: "Request not found" };
    }
    if (request.status !== "pending") {
      return { error: `Request is already ${request.status}` };
    }

    const { db } = await createAdminClient();
    await db.updateRow(DATABASE_ID, TABLE, requestId, {
      status: "rejected",
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
      reason,
    });

    await logAuditEvent(ctx, "approval.request.reject", {
      resourceId: requestId,
      resourceType: request.resource_type,
      payload: { action: request.action, reason },
    });

    revalidatePath("/inbox/approvals");
    return { data: requestId };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Rejection failed",
    };
  }
}
