import type { MemberPassCodeKind } from "@repo/shared/utils/member-pass";

export type ScanResult =
  | "valid"
  | "duplicate"
  | "check_id"
  | "denied"
  | "unavailable";

export type ScanDenialReason =
  | "bad_code"
  | "stale"
  | "expired"
  | "not_member"
  | "not_linked";

export type Scanner =
  | { kind: "staff"; userId: string }
  | { kind: "guest"; linkId: string };

/** What a scanner screen shows. Never carries student number or email. */
export interface ScanOutcome {
  expiryDate?: string;
  membershipName?: string;
  name?: string;
  reason?: ScanDenialReason;
  result: ScanResult;
  secondsSincePrevious?: number;
}

// Local row types until packages/api/types/appwrite.ts is regenerated with
// the member pass tables.
export interface MemberPassScanRow {
  $createdAt: string;
  $id: string;
  code_kind: MemberPassCodeKind | null;
  member_user_id: string;
  reason: string | null;
  result: ScanResult;
  scanner_link_id: string | null;
  scanner_user_id: string | null;
}

export interface ScannerLinkRow {
  $createdAt: string;
  $id: string;
  campus_id: string | null;
  created_by: string;
  expires_at: string;
  label: string;
  revoked_at: string | null;
  token_hash: string;
}

/** Results that mean "this pass was presented and let through". */
export const COUNTED_SCAN_RESULTS: ScanResult[] = [
  "valid",
  "duplicate",
  "check_id",
];
