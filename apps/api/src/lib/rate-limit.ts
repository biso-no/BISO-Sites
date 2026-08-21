import { consume, type RateLimitRule } from "@repo/shared/utils/rate-limit";
import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders } from "./cors";

/**
 * Identify the caller for rate-limiting purposes.
 *
 * The account id is strongly preferred: it survives IP changes, it is not
 * client-controlled, and it is what makes the per-user budgets in `RATE_LIMITS`
 * meaningful. The IP fallback exists only for routes that limit before they
 * know who is calling.
 *
 * `x-forwarded-for` is spoofable by anyone talking to the origin directly, so
 * the IP path is a speed bump rather than a control. That is an accepted
 * trade-off here — these budgets protect spend and inboxes, not access.
 */
function callerIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface EnforceRateLimitOptions {
  readonly origin: string | null;
  readonly req: NextRequest;
  readonly rules: readonly RateLimitRule[];
  /** Stable name for the budget, e.g. "expense-ocr". Namespaces the key. */
  readonly scope: string;
  /** Authenticated account id when known; falls back to the caller IP. */
  readonly userId?: string | null;
}

/**
 * Returns a 429 when the caller is over budget, or `null` to continue.
 *
 * Call it *after* authentication so the budget keys on the account rather than
 * a shared egress IP — several volunteers on campus wifi would otherwise share
 * one allowance.
 */
export function enforceRateLimit(
  options: EnforceRateLimitOptions
): NextResponse | null {
  const { scope, userId, req, rules, origin } = options;
  const identity = userId ? `user:${userId}` : `ip:${callerIp(req)}`;
  const result = consume(`${scope}:${identity}`, rules);

  if (result.allowed) {
    return null;
  }

  const response = NextResponse.json(
    {
      success: false,
      error: "Too many requests. Please wait a moment and try again.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    { status: 429 }
  );
  response.headers.set("Retry-After", String(result.retryAfterSeconds));

  return applyCorsHeaders(response, origin);
}
