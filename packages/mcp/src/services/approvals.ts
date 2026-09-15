/**
 * Approval requests.
 *
 * This is the one mechanism in the repo that constitutes real, persisted
 * business authorization: a row in `approval_requests`, readable and updatable
 * by a named approver team, which a campus or global admin decides on. It is
 * what makes "route this for approval" mean something rather than being a
 * message a model writes to itself.
 *
 * Its execution surface is narrow and is kept narrow here.
 * `buildApprovalPublishPlan` in the admin app throws unless the action is
 * `<domain>.publish` over exactly six domains — it is a publish queue, not a
 * general mutation queue. This service therefore refuses to file a request for
 * any other action rather than creating a row that nothing can ever execute.
 */

import { ID, Permission, Query, Role } from "@repo/api";
import type { BackendClients } from "../appwrite/clients";
import {
  OPERATIONS_UNIT_TEAM_ID,
  resolveApproverTeamId,
} from "../identity/campus";
import type { Principal } from "../identity/principal";
import { isAnonymous } from "../identity/principal";
import {
  forbidden,
  fromAppwriteError,
  notFound,
  notSupported,
} from "../runtime/errors";
import type { Projected } from "./row";

const TABLE = "approval_requests";

/**
 * Domains whose `<domain>.publish` the admin app can actually execute.
 *
 * Mirrors `PUBLISH_ACTIONS` in
 * `apps/admin/src/app/(portal)/_actions/approval-execution.ts`. Note `pages` is
 * absent there and so is absent here: a page publish has its own path.
 */
export const EXECUTABLE_APPROVAL_DOMAINS = [
  "benefits",
  "documents",
  "events",
  "jobs",
  "news",
  "shop",
] as const;

export type ApprovalDomain = (typeof EXECUTABLE_APPROVAL_DOMAINS)[number];

export interface ApprovalRequestView {
  action: string;
  approverTeamId: string;
  campusId: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  departmentId: string | null;
  id: string;
  /** The stored payload, parsed. Never re-serialised back into a write. */
  payload: Record<string, unknown> | null;
  reason: string | null;
  requesterEmail: string;
  requesterId: string;
  resourceId: string | null;
  resourceType: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
}

export interface ApprovalService {
  /** File a request. Refuses any action the execution allowlist cannot run. */
  create(
    principal: Principal,
    input: {
      domain: ApprovalDomain;
      resourceId: string;
      resourceType: string;
      campusId: string | null;
      departmentId: string | null;
      payload: Record<string, unknown>;
    }
  ): Promise<{ id: string; approverTeamId: string }>;
  get(id: string): Promise<ApprovalRequestView>;
  listPending(input: {
    limit: number;
    offset: number;
  }): Promise<{ rows: ApprovalRequestView[]; total: number }>;
}

function parsePayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

type ApprovalRow = Projected<{
  action: string;
  status: ApprovalRequestView["status"];
  resource_type: string;
  resource_id: string | null;
  campus_id: string | null;
  department_id: string | null;
  approver_team_id: string;
  requester_id: string;
  requester_email: string;
  decided_at: string | null;
  decided_by: string | null;
  reason: string | null;
  payload: string;
}>;

function toView(row: ApprovalRow): ApprovalRequestView {
  return {
    id: row.$id,
    action: row.action,
    status: row.status,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    campusId: row.campus_id,
    departmentId: row.department_id,
    approverTeamId: row.approver_team_id,
    requesterId: row.requester_id,
    requesterEmail: row.requester_email,
    createdAt: row.$createdAt,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    reason: row.reason,
    payload: parsePayload(row.payload),
  };
}

export function createApprovalService(
  clients: BackendClients
): ApprovalService {
  return {
    async listPending(input) {
      try {
        // `approval_requests` has row security on and no table-level grants, so
        // the caller's own client returns exactly the rows their approver-team
        // membership permits. No application-side filter is needed or wanted:
        // adding one could only narrow it further and would drift from the
        // portal's own inbox.
        const result = await clients.user.db.listRows<ApprovalRow>(
          "app",
          TABLE,
          [
            Query.equal("status", "pending"),
            Query.orderDesc("$createdAt"),
            Query.limit(input.limit),
            Query.offset(input.offset),
          ]
        );
        return { rows: result.rows.map(toView), total: result.total };
      } catch (error) {
        throw fromAppwriteError(error, { operation: "list approvals" });
      }
    },

    async get(id) {
      try {
        const row = await clients.user.db.getRow<ApprovalRow>("app", TABLE, id);
        return toView(row);
      } catch (error) {
        const mapped = fromAppwriteError(error, { operation: "get approval" });
        if (mapped.code === "forbidden" || mapped.code === "not_found") {
          throw notFound(`No approval request ${id} is visible to you.`, {
            id,
          });
        }
        throw mapped;
      }
    },

    async create(principal, input) {
      if (isAnonymous(principal)) {
        throw forbidden(
          "Filing an approval request requires a verified identity."
        );
      }
      const action = `${input.domain}.publish`;
      if (
        !(EXECUTABLE_APPROVAL_DOMAINS as readonly string[]).includes(
          input.domain
        )
      ) {
        throw notSupported(
          `Approval requests can only be filed for publishing ${EXECUTABLE_APPROVAL_DOMAINS.join(", ")}.`,
          { requested: input.domain }
        );
      }

      const approverTeamId = resolveApproverTeamId(action, input.campusId);

      // Row permissions mirror `createApprovalRequest` exactly: the approver
      // team reads and updates, Operations Unit always reads and updates, and
      // the requester reads their own request. Getting this wrong makes the
      // request invisible to the people who must decide it.
      const permissions = [
        Permission.read(Role.team(approverTeamId)),
        Permission.update(Role.team(approverTeamId)),
        Permission.read(Role.team(OPERATIONS_UNIT_TEAM_ID)),
        Permission.update(Role.team(OPERATIONS_UNIT_TEAM_ID)),
        Permission.read(Role.user(principal.userId)),
      ];

      const { db } = clients.requireElevated(
        "create approval request (approval_requests has no table-level create grant)"
      );

      try {
        const id = ID.unique();
        await db.createRow(
          "app",
          TABLE,
          id,
          {
            requester_id: principal.userId,
            requester_email: principal.email ?? "",
            action,
            resource_type: input.resourceType,
            resource_id: input.resourceId,
            payload: JSON.stringify(input.payload),
            campus_id: input.campusId,
            department_id: input.departmentId,
            approver_team_id: approverTeamId,
            status: "pending",
            decided_by: null,
            decided_at: null,
            reason: null,
          },
          permissions
        );
        return { id, approverTeamId };
      } catch (error) {
        throw fromAppwriteError(error, {
          operation: "create approval request",
        });
      }
    },
  };
}
