/**
 * Fixed-window, in-process rate limiting for public server actions.
 *
 * Keyed per source, never per recipient. A global cap on how much mail one
 * varsling contact may receive would hand an attacker a way to close the
 * channel by spending the budget — which is the harm this is meant to prevent.
 * A per-source window bounds what any one client can send and leaves every
 * other reporter unaffected.
 *
 * Stated plainly, because overstating a security control is worse than not
 * having one:
 * - State lives in the process. Each instance keeps its own counters and a
 *   restart clears them. This raises the cost of a flood; it is not a quota.
 * - Every uncertain path fails OPEN. Silently dropping a whistleblowing report
 *   is far worse than accepting one more than the limit allows.
 *
 * On the key, which is the subtle part. A caller can put anything in
 * `x-forwarded-for`, so the leftmost entry is attacker-chosen. Keying on it
 * would not merely let someone evade their own limit — it would let them spend
 * a *chosen* address's window and have real reports from that network refused.
 * On a whistleblowing form that turns an abuse control into a way to silence a
 * specific campus for the price of five requests, which is far worse than the
 * flood it defends against.
 *
 * So trust is configuration, never inference — nothing in the header itself
 * says whether an ingress wrote it. Limiting is OFF until one of these is set:
 *
 *   RATE_LIMIT_CLIENT_IP_HEADER   a header the ingress sets authoritatively
 *                                 and a client cannot forge through it
 *                                 (e.g. `cf-connecting-ip`, or `x-real-ip`
 *                                 where the proxy overwrites it).
 *   RATE_LIMIT_TRUSTED_PROXY_HOPS how many proxies in front append to
 *                                 `x-forwarded-for`. With N set, the entry N
 *                                 from the right is the one the innermost
 *                                 trusted proxy wrote, which a client cannot
 *                                 reach. One ingress that appends => 1.
 *
 * Unset means every caller is unidentified, so nothing is limited. That is the
 * deliberate default: an unmetered flood fills an inbox and is visible and
 * recoverable, while a forged key quietly turns away the report the channel
 * exists to carry.
 */

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /**
   * A non-binding peek, for rejecting an already-exhausted key cheaply. It
   * reserves nothing, so it must NOT be the only gate before a limited
   * operation — see `reserve`.
   */
  check(key: string): RateLimitDecision;
  /**
   * The enforcement point: tests the limit and claims a slot in one
   * synchronous step.
   *
   * Being synchronous is what makes it safe. JavaScript will not interleave
   * another request into this function, so concurrent callers are serialised
   * and exactly `limit` of them can win. A split check-then-increment with an
   * `await` in the middle has the opposite property: every request in a
   * parallel batch passes the check before any of them increments, which lets
   * a caller past the cap simply by firing at once. Call this immediately
   * before the operation being limited, with nothing awaited in between.
   */
  reserve(key: string): RateLimitDecision;
}

interface CountingWindow {
  count: number;
  resetAt: number;
}

/** Ceiling on tracked keys, so the limiter cannot become the memory leak. */
const MAX_TRACKED_KEYS = 10_000;
const MS_PER_SECOND = 1000;

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const windows = new Map<string, CountingWindow>();

  const liveWindow = (key: string, now: number): CountingWindow | undefined => {
    const window = windows.get(key);
    if (!window || window.resetAt <= now) {
      return;
    }
    return window;
  };

  const dropExpired = (now: number): void => {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) {
        windows.delete(key);
      }
    }
  };

  return {
    check(key) {
      const now = Date.now();
      const window = liveWindow(key, now);

      if (!window || window.count < options.limit) {
        return { allowed: true, retryAfterSeconds: 0 };
      }

      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((window.resetAt - now) / MS_PER_SECOND),
      };
    },

    reserve(key) {
      const now = Date.now();
      const window = liveWindow(key, now);

      if (window) {
        if (window.count >= options.limit) {
          return {
            allowed: false,
            retryAfterSeconds: Math.ceil(
              (window.resetAt - now) / MS_PER_SECOND
            ),
          };
        }
        window.count += 1;
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (windows.size >= MAX_TRACKED_KEYS) {
        dropExpired(now);
      }
      if (windows.size >= MAX_TRACKED_KEYS) {
        // Still full of live windows: stop tracking new keys rather than
        // growing without bound. Fails open, per the note above.
        return { allowed: true, retryAfterSeconds: 0 };
      }

      windows.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

function parseTrustedHops(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Identifies the caller for rate-limiting purposes, or `null` when the
 * deployment has not declared where a trustworthy address comes from.
 *
 * `null` is never a shared bucket. Bucketing unidentified callers together
 * would let ordinary traffic exhaust one window and start refusing genuine
 * reports — the same harm as a forged key, reached a different way.
 */
export function clientKeyFromHeaders(requestHeaders: Headers): string | null {
  const providerHeader = process.env.RATE_LIMIT_CLIENT_IP_HEADER?.trim();
  if (providerHeader) {
    return requestHeaders.get(providerHeader)?.trim() || null;
  }

  const trustedHops = parseTrustedHops(
    process.env.RATE_LIMIT_TRUSTED_PROXY_HOPS
  );
  if (trustedHops === null) {
    return null;
  }

  const chain =
    requestHeaders
      .get("x-forwarded-for")
      ?.split(",")
      .map((hop) => hop.trim())
      .filter(Boolean) ?? [];

  // Count from the right: those entries were appended by our own proxies, so a
  // client cannot place a value there. A chain shorter than the configured hop
  // count means the request did not arrive the way the config describes, so
  // there is no entry we can trust — fail open rather than key on a guess.
  const index = chain.length - trustedHops;
  return index >= 0 ? (chain[index] ?? null) : null;
}
