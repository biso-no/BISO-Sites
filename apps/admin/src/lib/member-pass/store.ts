import { ID, Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type { MemberPassCodeKind } from "@repo/shared/utils/member-pass";
import {
  COUNTED_SCAN_RESULTS,
  type MemberPassScanRow,
  type Scanner,
  type ScannerLinkRow,
  type ScanResult,
} from "./types";

export type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

export const MEMBER_PASS_DB = "app";
export const SCANS_TABLE = "member_pass_scans";
export const LINKS_TABLE = "member_pass_scanner_links";
const MAX_LINKS_LISTED = 100;

// No row permissions: both tables are read and written with the service key only.
const NO_PERMISSIONS: string[] = [];

export async function findLatestCountedScan(
  db: AdminDb,
  memberUserId: string,
  since: Date
): Promise<MemberPassScanRow | null> {
  // listRows's generic requires a full Models.Row shape, which our local
  // types omit; call it untyped and cast the rows instead (same workaround
  // as apps/web/src/lib/actions/bi-identity.ts).
  const { rows } = await db.listRows(MEMBER_PASS_DB, SCANS_TABLE, [
    Query.equal("member_user_id", memberUserId),
    Query.equal("result", COUNTED_SCAN_RESULTS),
    Query.greaterThan("$createdAt", since.toISOString()),
    Query.orderDesc("$createdAt"),
    Query.limit(1),
  ]);
  return (rows[0] as unknown as MemberPassScanRow | undefined) ?? null;
}

export async function recordScan(
  db: AdminDb,
  scan: {
    codeKind: MemberPassCodeKind | null;
    memberUserId: string;
    reason: string | null;
    result: ScanResult;
    scanner: Scanner;
  }
): Promise<void> {
  await db.createRow(
    MEMBER_PASS_DB,
    SCANS_TABLE,
    ID.unique(),
    {
      code_kind: scan.codeKind,
      member_user_id: scan.memberUserId,
      reason: scan.reason,
      result: scan.result,
      scanner_link_id:
        scan.scanner.kind === "guest" ? scan.scanner.linkId : null,
      scanner_user_id:
        scan.scanner.kind === "staff" ? scan.scanner.userId : null,
    },
    NO_PERMISSIONS
  );
}

export async function findLinkByTokenHash(
  db: AdminDb,
  tokenHash: string
): Promise<ScannerLinkRow | null> {
  const { rows } = await db.listRows(MEMBER_PASS_DB, LINKS_TABLE, [
    Query.equal("token_hash", tokenHash),
    Query.limit(1),
  ]);
  return (rows[0] as unknown as ScannerLinkRow | undefined) ?? null;
}

export async function getLinkRow(
  db: AdminDb,
  linkId: string
): Promise<ScannerLinkRow | null> {
  return (await db
    .getRow(MEMBER_PASS_DB, LINKS_TABLE, linkId)
    .catch(() => null)) as unknown as ScannerLinkRow | null;
}

export async function createLinkRow(
  db: AdminDb,
  link: {
    campusId: string | null;
    createdBy: string;
    expiresAt: Date;
    label: string;
    tokenHash: string;
  }
): Promise<ScannerLinkRow> {
  return (await db.createRow(
    MEMBER_PASS_DB,
    LINKS_TABLE,
    ID.unique(),
    {
      campus_id: link.campusId,
      created_by: link.createdBy,
      expires_at: link.expiresAt.toISOString(),
      label: link.label,
      revoked_at: null,
      token_hash: link.tokenHash,
    },
    NO_PERMISSIONS
  )) as unknown as ScannerLinkRow;
}

export async function revokeLinkRow(
  db: AdminDb,
  linkId: string,
  now: Date
): Promise<void> {
  await db.updateRow(MEMBER_PASS_DB, LINKS_TABLE, linkId, {
    revoked_at: now.toISOString(),
  });
}

/** Unexpired, unrevoked links; `campusIds === null` means every campus. */
export async function listLiveLinks(
  db: AdminDb,
  now: Date,
  campusIds: string[] | null
): Promise<ScannerLinkRow[]> {
  const queries = [
    Query.greaterThan("expires_at", now.toISOString()),
    Query.isNull("revoked_at"),
    Query.orderAsc("expires_at"),
    Query.limit(MAX_LINKS_LISTED),
  ];
  if (campusIds) {
    queries.push(Query.equal("campus_id", campusIds));
  }
  const { rows } = await db.listRows(MEMBER_PASS_DB, LINKS_TABLE, queries);
  return rows as unknown as ScannerLinkRow[];
}
