import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for shared secrets (cron/sync tokens).
 * A plain `===` short-circuits on the first differing character, which
 * leaks timing information an attacker can use to recover the secret
 * byte-by-byte. Only the length of the secret is observable here.
 */
export function safeSecretCompare(
  candidate: string | null | undefined,
  secret: string
): boolean {
  if (!candidate) {
    return false;
  }
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
