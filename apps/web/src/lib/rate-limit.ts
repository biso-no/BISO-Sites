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
 * - The key comes from `x-forwarded-for`, which a client can send. Anything
 *   upstream that appends to that header rather than replacing it can be
 *   walked around by rotating the value. This stops a naive flood, not a
 *   determined attacker.
 * - Every uncertain path fails OPEN. Silently dropping a whistleblowing report
 *   is far worse than accepting one more than the limit allows.
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

/**
 * Identifies the caller for rate-limiting purposes, or `null` when no proxy
 * header names them.
 *
 * Returning `null` — rather than bucketing every unidentified caller together
 * under one shared key — is deliberate: a shared bucket would let ordinary
 * traffic exhaust a single window and start rejecting genuine reports.
 */
export function clientKeyFromHeaders(requestHeaders: Headers): string | null {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const firstHop = forwardedFor?.split(",")[0]?.trim();
  if (firstHop) {
    return firstHop;
  }

  return requestHeaders.get("x-real-ip")?.trim() || null;
}
