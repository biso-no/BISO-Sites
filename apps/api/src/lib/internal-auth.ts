// Shared check for server-to-server callers (admin, cron, remediation queue):
// they authenticate with CRON_SECRET as a Bearer token or `x-cron-secret`.

import { safeSecretCompare } from "@repo/shared/utils/secrets";

const BEARER_PREFIX = "Bearer ";

export function isInternalRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const authHeader = request.headers.get("authorization");
  const candidates = [
    authHeader?.startsWith(BEARER_PREFIX)
      ? authHeader.slice(BEARER_PREFIX.length)
      : null,
    request.headers.get("x-cron-secret"),
  ];
  return candidates.some((candidate) => safeSecretCompare(candidate, secret));
}
