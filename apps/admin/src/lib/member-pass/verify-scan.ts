import type { Users } from "@repo/api/types/appwrite";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import {
  DUPLICATE_SCAN_WINDOW_MS,
  type MemberPassCodeKind,
  verifyMemberPassCode,
} from "@repo/shared/utils/member-pass";
import {
  type MembershipStatus,
  pickCurrentMembership,
} from "@repo/shared/utils/membership-status";
import { type AdminDb, findLatestCountedScan, recordScan } from "./store";
import type {
  ScanDenialReason,
  Scanner,
  ScanOutcome,
  ScanResult,
} from "./types";

type RecordScanInput = Parameters<typeof recordScan>[1];

export interface ScanLog {
  latestSince: (
    memberUserId: string,
    since: Date
  ) => Promise<{ $createdAt: string } | null>;
  record: (entry: RecordScanInput) => Promise<void>;
}

export function scanLogFor(db: AdminDb): ScanLog {
  return {
    latestSince: (memberUserId, since) =>
      findLatestCountedScan(db, memberUserId, since),
    record: (entry) => recordScan(db, entry),
  };
}

export interface VerifyScanDeps {
  db: AdminDb;
  getStatus: (studentNumber: number) => Promise<MembershipStatus>;
  now: Date;
  scans: ScanLog;
  secret: string;
}

const CODE_REASONS: Record<string, ScanDenialReason> = {
  bad_signature: "bad_code",
  expired: "expired",
  malformed: "bad_code",
  stale: "stale",
};

function isRowNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

type ProfileLookup = { ok: true; profile: Users | null } | { ok: false };

/**
 * Loads the member's profile row. Only a 404 means "no such user" (denied,
 * `not_linked`) — any other failure (outage, timeout) is reported as `ok:
 * false` so the caller answers `unavailable` instead of silently treating an
 * Appwrite blip as an unlinked account.
 */
async function fetchProfile(
  db: AdminDb,
  userId: string
): Promise<ProfileLookup> {
  try {
    const profile = await db.getRow<Users>("app", "user", userId);
    return { ok: true, profile };
  } catch (error) {
    if (isRowNotFound(error)) {
      return { ok: true, profile: null };
    }
    console.error("[Member Pass] Profile lookup failed:", error);
    return { ok: false };
  }
}

async function log(
  deps: VerifyScanDeps,
  entry: {
    codeKind: MemberPassCodeKind;
    memberUserId: string;
    reason: ScanDenialReason | null;
    result: ScanResult;
    scanner: Scanner;
  }
) {
  try {
    await deps.scans.record(entry);
  } catch (error) {
    console.error("[Member Pass] Could not record scan:", error);
  }
}

async function previousScanAt(
  deps: VerifyScanDeps,
  userId: string
): Promise<Date | null> {
  try {
    const since = new Date(deps.now.getTime() - DUPLICATE_SCAN_WINDOW_MS);
    const latest = await deps.scans.latestSince(userId, since);
    return latest ? new Date(latest.$createdAt) : null;
  } catch (error) {
    console.error("[Member Pass] Duplicate check failed:", error);
    return null;
  }
}

/**
 * Checks a scanned code end to end: signature and time, the member's linked
 * student number, a live Finago lookup, and the recent-scan log.
 */
export async function verifyScan(
  code: string,
  scanner: Scanner,
  deps: VerifyScanDeps
): Promise<ScanOutcome> {
  const parsed = verifyMemberPassCode(code, deps.secret, deps.now);
  if (!parsed.ok) {
    return {
      reason: CODE_REASONS[parsed.reason] ?? "bad_code",
      result: "denied",
    };
  }
  const { kind, userId } = parsed;

  const lookup = await fetchProfile(deps.db, userId);
  if (!lookup.ok) {
    await log(deps, {
      codeKind: kind,
      memberUserId: userId,
      reason: null,
      result: "unavailable",
      scanner,
    });
    return { result: "unavailable" };
  }
  const { profile } = lookup;
  const studentNumber = sanitizeStudentNumber(profile?.student_id);
  const name = profile?.name?.trim() || undefined;
  if (studentNumber === null) {
    await log(deps, {
      codeKind: kind,
      memberUserId: userId,
      reason: "not_linked",
      result: "denied",
      scanner,
    });
    return { name, reason: "not_linked", result: "denied" };
  }

  let status: MembershipStatus;
  try {
    status = await deps.getStatus(studentNumber);
  } catch (error) {
    console.error("[Member Pass] Membership lookup failed:", error);
    await log(deps, {
      codeKind: kind,
      memberUserId: userId,
      reason: null,
      result: "unavailable",
      scanner,
    });
    return { result: "unavailable" };
  }

  if (!status.isMember) {
    const reason: ScanDenialReason =
      status.reason === "expired" ? "expired" : "not_member";
    await log(deps, {
      codeKind: kind,
      memberUserId: userId,
      reason,
      result: "denied",
      scanner,
    });
    return { name, reason, result: "denied" };
  }

  const current = pickCurrentMembership(status.memberships);
  const previous = await previousScanAt(deps, userId);
  let result: ScanResult = "valid";
  if (previous) {
    result = "duplicate";
  } else if (kind === "apple") {
    result = "check_id";
  }
  await log(deps, {
    codeKind: kind,
    memberUserId: userId,
    reason: null,
    result,
    scanner,
  });

  return {
    expiryDate: current?.expiryDate,
    membershipName: current?.name,
    name,
    result,
    ...(previous
      ? {
          secondsSincePrevious: Math.round(
            (deps.now.getTime() - previous.getTime()) / 1000
          ),
        }
      : {}),
  };
}
