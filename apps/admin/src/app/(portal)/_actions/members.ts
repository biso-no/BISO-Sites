"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { requireNavAccess } from "@/lib/authorization";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import { applyScopeQueries, hasRowAccess } from "@/lib/utils/authorization";

// The list view only ever reads campus name + the most recent membership's
// name/status, so it selects just those relationship fields rather than the
// full membership history (price, dates, ...) for every one of up to 200 rows.
const MEMBER_LIST_SELECT = [
  "*",
  "campus.name",
  "studentId.isMember",
  "studentId.expiry_date",
  "studentId.memberships.name",
  "studentId.memberships.status",
];
const MEMBER_DETAIL_SELECT = [
  "*",
  "campus.*",
  "studentId.*",
  "studentId.memberships.*",
];

export interface MemberListItem {
  campusId: string | null;
  campusName: string | null;
  email: string | null;
  expiryDate: string | null;
  id: string;
  isMember: boolean;
  name: string | null;
  planName: string | null;
}

export interface MembershipHistoryEntry {
  expiryDate: string;
  name: string;
  price: number;
  startDate: string;
  status: boolean;
}

export interface MemberDetail extends MemberListItem {
  bio: string | null;
  memberships: MembershipHistoryEntry[];
  phone: string | null;
}

function toMemberListItem(row: Users): MemberListItem {
  const studentId = row.studentId;
  const memberships = studentId?.memberships ?? [];
  const activePlan = memberships.find((m) => m.status) ?? memberships.at(-1);

  return {
    campusId: row.campus_id,
    campusName:
      row.campus?.name ?? CAMPUS_ID_TO_NAME[row.campus_id ?? ""] ?? null,
    email: row.email,
    expiryDate: studentId?.expiry_date ?? null,
    id: row.$id,
    isMember: Boolean(studentId?.isMember),
    name: row.name,
    planName: activePlan?.name ?? null,
  };
}

/**
 * Members list, scoped by campus for campus admins (global admins see
 * everyone, or their active-campus filter if set via the sidebar campus
 * switcher — same as every other admin list). `user`/`studentId`/
 * `memberships` carry light or no row security, so this uses the service
 * client with `applyScopeQueries` as the real authorization boundary,
 * matching `listPages()`.
 */
export async function listMembers(opts?: {
  q?: string;
  status?: "active" | "inactive";
}): Promise<MemberListItem[]> {
  const ctx = await requireNavAccess("portal.members");
  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.select(MEMBER_LIST_SELECT),
    Query.orderAsc("name"),
    Query.limit(200),
    ...applyScopeQueries(ctx, { departmentField: null }),
  ];

  const q = opts?.q?.trim();
  if (q) {
    queries.push(
      Query.or([Query.contains("name", q), Query.contains("email", q)])
    );
  }

  const result = await db.listRows<Users>("app", "user", queries);
  let members = result.rows.map(toMemberListItem);

  if (opts?.status) {
    const wantActive = opts.status === "active";
    members = members.filter((member) => member.isMember === wantActive);
  }

  return members;
}

/**
 * Single member's profile + membership history. Row-level scope is checked
 * explicitly (not just the nav gate) so a campus admin can't view another
 * campus's member by guessing a URL.
 */
export async function getMemberDetail(
  userId: string
): Promise<MemberDetail | null> {
  const ctx = await requireNavAccess("portal.members");
  const { db } = await createAdminClient();

  let row: Users;
  try {
    row = await db.getRow<Users>("app", "user", userId, [
      Query.select(MEMBER_DETAIL_SELECT),
    ]);
  } catch {
    return null;
  }

  if (!hasRowAccess(ctx, row.campus_id, null)) {
    return null;
  }

  return {
    ...toMemberListItem(row),
    bio: row.bio,
    memberships: (row.studentId?.memberships ?? []).map((membership) => ({
      expiryDate: membership.expiryDate,
      name: membership.name,
      price: membership.price,
      startDate: membership.startDate,
      status: membership.status,
    })),
    phone: row.phone,
  };
}
