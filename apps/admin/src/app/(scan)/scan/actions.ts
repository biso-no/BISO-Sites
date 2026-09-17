"use server";

import { createAdminClient } from "@repo/api/server";
import { readMemberPassSecret } from "@repo/shared/utils/member-pass";
import { hashGuestToken, isLinkUsable } from "@/lib/member-pass/guest-links";
import { getScanMembershipStatus } from "@/lib/member-pass/membership-lookup";
import { createRateLimiter } from "@/lib/member-pass/rate-limit";
import { findLinkByTokenHash } from "@/lib/member-pass/store";
import type { ScannerLinkRow, ScanOutcome } from "@/lib/member-pass/types";
import { scanLogFor, verifyScan } from "@/lib/member-pass/verify-scan";

const MAX_TOKEN_LENGTH = 128;
const allowScan = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });

type GuestScanResult =
  | { data: ScanOutcome; success: true }
  | {
      error: "invalid_link" | "rate_limited" | "not_configured" | "failed";
      success: false;
    };

export async function resolveGuestLink(
  token: string
): Promise<ScannerLinkRow | null> {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return null;
  }
  const { db } = await createAdminClient();
  const link = await findLinkByTokenHash(db, hashGuestToken(token));
  return isLinkUsable(link, new Date()) ? link : null;
}

/**
 * A scan from a guest scanner link. The link is re-checked on every scan so
 * revoking it takes effect immediately.
 */
export async function scanWithGuestLink(
  token: string,
  code: string
): Promise<GuestScanResult> {
  const secret = readMemberPassSecret();
  if (!secret) {
    return { error: "not_configured", success: false };
  }
  try {
    const link = await resolveGuestLink(token);
    if (!link) {
      return { error: "invalid_link", success: false };
    }
    if (!allowScan(link.$id)) {
      return { error: "rate_limited", success: false };
    }
    const { db } = await createAdminClient();
    const outcome = await verifyScan(
      code.trim(),
      { kind: "guest", linkId: link.$id },
      {
        db,
        getStatus: getScanMembershipStatus,
        now: new Date(),
        scans: scanLogFor(db),
        secret,
      }
    );
    return { data: outcome, success: true };
  } catch (error) {
    console.error("[Member Pass] Guest scan failed:", error);
    return { error: "failed", success: false };
  }
}
