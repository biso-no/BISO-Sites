import { createHash, randomBytes } from "node:crypto";
import type { ScannerLinkRow } from "./scan-types";

export const GUEST_LINK_DEFAULT_HOURS = 6;
export const GUEST_LINK_MAX_HOURS = 48;
const HOUR_MS = 60 * 60 * 1000;
const TOKEN_BYTES = 32;

export function generateGuestToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Only the hash is stored, so a leaked table cannot open a scanner. */
export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isLinkUsable(
  link: Pick<ScannerLinkRow, "expires_at" | "revoked_at"> | null,
  now: Date
): boolean {
  if (!link || link.revoked_at) {
    return false;
  }
  return Date.parse(link.expires_at) > now.getTime();
}

export function resolveLinkExpiry(
  requested: Date | null,
  now: Date
): Date | null {
  const nowMs = now.getTime();
  if (!requested) {
    return new Date(nowMs + GUEST_LINK_DEFAULT_HOURS * HOUR_MS);
  }
  const requestedMs = requested.getTime();
  if (!Number.isFinite(requestedMs) || requestedMs <= nowMs) {
    return null;
  }
  return new Date(
    Math.min(requestedMs, nowMs + GUEST_LINK_MAX_HOURS * HOUR_MS)
  );
}
