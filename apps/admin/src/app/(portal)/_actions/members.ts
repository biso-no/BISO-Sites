"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, MemberRoster } from "@repo/api/types/appwrite";
import { requireNavAccess } from "@/lib/authorization";
import type { ListParams, PaginatedResult } from "@/lib/list-params";
import { paginationQueries } from "@/lib/list-queries";
import {
  type RosterStatus,
  summarizeRosterExecutions,
} from "@/lib/member-roster-status";
import { applyScopeQueries } from "@/lib/utils/authorization";

const ROSTER_TABLE = "member_roster";
/** Enough history to find the last success behind a run of failures. */
const STATUS_EXECUTION_WINDOW = 20;

export interface RosterMemberItem {
  campusId: string | null;
  campusName: string | null;
  email: string | null;
  expiryDate: string;
  id: string;
  name: string;
  planName: string;
}

/**
 * Paid members synced from 24SevenOffice (see functions/member-roster-sync).
 * Campus admins see their campuses only; rows with an unknown campus
 * (`campus_id` null) are therefore visible to global admins only, which
 * `applyScopeQueries`' `Query.equal("campus_id", …)` gives for free. The
 * roster carries no row security, so the service client plus that scoping is
 * the authorization boundary, as in the previous user-based list.
 */
export async function listRosterMembers(
  params: ListParams
): Promise<PaginatedResult<RosterMemberItem>> {
  const ctx = await requireNavAccess("portal.members");
  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.orderAsc("name"),
    ...paginationQueries(params),
    ...applyScopeQueries(ctx, { departmentField: null }),
  ];
  if (params.q) {
    queries.push(
      Query.or([
        Query.search("name", params.q),
        Query.search("email", params.q),
      ])
    );
  }

  const [result, campuses] = await Promise.all([
    db.listRows<MemberRoster>("app", ROSTER_TABLE, queries),
    db.listRows<Campus>("app", "campus", [
      Query.select(["$id", "name"]),
      Query.limit(100),
    ]),
  ]);
  const campusNames = new Map(campuses.rows.map((c) => [c.$id, c.name]));

  return {
    page: params.page,
    rows: result.rows.map((row) => ({
      campusId: row.campus_id,
      campusName: row.campus_id
        ? (campusNames.get(row.campus_id) ?? null)
        : null,
      email: row.email,
      expiryDate: row.expiry_date,
      id: row.$id,
      name: row.name,
      planName: row.membership_name,
    })),
    size: params.size,
    total: result.total,
  };
}

function rosterFunctionId(): string | null {
  return process.env.MEMBER_ROSTER_FUNCTION_ID || null;
}

async function readRosterStatus(functionId: string): Promise<RosterStatus> {
  const { functions } = await createAdminClient();
  const list = await functions.listExecutions({
    functionId,
    queries: [
      Query.orderDesc("$createdAt"),
      Query.limit(STATUS_EXECUTION_WINDOW),
    ],
  });
  return summarizeRosterExecutions(list.executions);
}

export async function getRosterStatus(): Promise<
  RosterStatus & { canRefresh: boolean }
> {
  const ctx = await requireNavAccess("portal.members");
  const functionId = rosterFunctionId();
  if (!functionId) {
    return {
      canRefresh: false,
      lastFailedAt: null,
      lastRefreshedAt: null,
      running: false,
    };
  }
  return {
    ...(await readRosterStatus(functionId)),
    canRefresh: ctx.roles.includes("globaladmin"),
  };
}

/**
 * Global admins only. Starts an async execution unless one is already queued
 * or running; the function also exits early on overlap, this just avoids
 * queueing a pointless second run.
 */
export async function refreshMemberRoster(): Promise<{
  ok: boolean;
  reason?: "forbidden" | "already-running" | "not-configured";
}> {
  const ctx = await requireNavAccess("portal.members");
  if (!ctx.roles.includes("globaladmin")) {
    return { ok: false, reason: "forbidden" };
  }
  const functionId = rosterFunctionId();
  if (!functionId) {
    return { ok: false, reason: "not-configured" };
  }
  if ((await readRosterStatus(functionId)).running) {
    return { ok: false, reason: "already-running" };
  }

  const { functions } = await createAdminClient();
  await functions.createExecution({ async: true, functionId });
  return { ok: true };
}
