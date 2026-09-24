import { ID, Query } from "@repo/api";
import { orNullIfNotFound } from "@repo/api/errors";
import type { AdminDb } from "./scan-store";
import { MEMBER_PASS_DB } from "./scan-store";

export const SCANNER_GRANTS_TABLE = "member_pass_scanners";
const MAX_GRANTS_LISTED = 200;

// No row permissions: the table is read and written with the service key only.
const NO_PERMISSIONS: string[] = [];

export interface ScannerGrantRow {
  $createdAt: string;
  $id: string;
  campus_id: string | null;
  email: string;
  expires_at: string | null;
  granted_by: string;
  invited_at: string | null;
  name: string | null;
  revoked_at: string | null;
  user_id: string;
}

export type GrantStatus = "active" | "expired" | "revoked";

export function grantStatus(
  grant: Pick<ScannerGrantRow, "expires_at" | "revoked_at">,
  now: Date
): GrantStatus {
  if (grant.revoked_at) {
    return "revoked";
  }
  if (grant.expires_at && new Date(grant.expires_at) <= now) {
    return "expired";
  }
  return "active";
}

export function isGrantActive(
  grant: Pick<ScannerGrantRow, "expires_at" | "revoked_at">,
  now: Date
): boolean {
  return grantStatus(grant, now) === "active";
}

/**
 * Not-expired filter pushed into the query itself: `expires_at` is null, or
 * still in the future. Appwrite's default page size (25) could otherwise
 * leave the one active grant off the page for a user with many old expired
 * grants, so we can't rely on filtering expiry in code alone.
 */
function notExpiredQuery(now: Date): string {
  return Query.or([
    Query.isNull("expires_at"),
    Query.greaterThan("expires_at", now.toISOString()),
  ]);
}

export async function findActiveGrantForUser(
  db: AdminDb,
  userId: string,
  now: Date
): Promise<ScannerGrantRow | null> {
  const { rows } = await db.listRows(MEMBER_PASS_DB, SCANNER_GRANTS_TABLE, [
    Query.equal("user_id", userId),
    Query.isNull("revoked_at"),
    notExpiredQuery(now),
    Query.orderDesc("$createdAt"),
    Query.limit(1),
  ]);
  // isGrantActive stays as a safety net even though the query already
  // filters revoked/expired rows.
  const active = (rows as unknown as ScannerGrantRow[]).find((row) =>
    isGrantActive(row, now)
  );
  return active ?? null;
}

export async function findActiveGrantForUserAndCampus(
  db: AdminDb,
  userId: string,
  campusId: string | null,
  now: Date
): Promise<ScannerGrantRow | null> {
  const { rows } = await db.listRows(MEMBER_PASS_DB, SCANNER_GRANTS_TABLE, [
    Query.equal("user_id", userId),
    Query.isNull("revoked_at"),
    notExpiredQuery(now),
    campusId === null
      ? Query.isNull("campus_id")
      : Query.equal("campus_id", campusId),
    Query.orderDesc("$createdAt"),
    Query.limit(1),
  ]);
  // isGrantActive stays as a safety net even though the query already
  // filters revoked/expired rows.
  const active = (rows as unknown as ScannerGrantRow[]).find((row) =>
    isGrantActive(row, now)
  );
  return active ?? null;
}

/** All grants (including expired and revoked), newest first. */
export async function listGrants(
  db: AdminDb,
  campusIds: string[] | null
): Promise<ScannerGrantRow[]> {
  const queries = [
    Query.orderDesc("$createdAt"),
    Query.limit(MAX_GRANTS_LISTED),
  ];
  if (campusIds) {
    queries.push(Query.equal("campus_id", campusIds));
  }
  const { rows } = await db.listRows(
    MEMBER_PASS_DB,
    SCANNER_GRANTS_TABLE,
    queries
  );
  return rows as unknown as ScannerGrantRow[];
}

export async function getGrant(
  db: AdminDb,
  id: string
): Promise<ScannerGrantRow | null> {
  // null only on 404; any other failure throws rather than posing as a
  // missing grant.
  return (await orNullIfNotFound(
    db.getRow(MEMBER_PASS_DB, SCANNER_GRANTS_TABLE, id)
  )) as unknown as ScannerGrantRow | null;
}

export async function createGrant(
  db: AdminDb,
  input: {
    campusId: string | null;
    email: string;
    expiresAt: Date | null;
    grantedBy: string;
    name: string | null;
    userId: string;
  }
): Promise<ScannerGrantRow> {
  return (await db.createRow(
    MEMBER_PASS_DB,
    SCANNER_GRANTS_TABLE,
    ID.unique(),
    {
      campus_id: input.campusId,
      email: input.email,
      expires_at: input.expiresAt ? input.expiresAt.toISOString() : null,
      granted_by: input.grantedBy,
      invited_at: null,
      name: input.name,
      revoked_at: null,
      user_id: input.userId,
    },
    NO_PERMISSIONS
  )) as unknown as ScannerGrantRow;
}

export async function updateGrant(
  db: AdminDb,
  id: string,
  patch: Partial<Pick<ScannerGrantRow, "expires_at" | "invited_at" | "name">>
): Promise<void> {
  await db.updateRow(MEMBER_PASS_DB, SCANNER_GRANTS_TABLE, id, patch);
}

export async function revokeGrant(
  db: AdminDb,
  id: string,
  now: Date
): Promise<void> {
  await db.updateRow(MEMBER_PASS_DB, SCANNER_GRANTS_TABLE, id, {
    revoked_at: now.toISOString(),
  });
}
