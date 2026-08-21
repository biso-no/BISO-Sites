/**
 * Sliding-window rate limiting, in process memory.
 *
 * Scope and honesty about it: state lives in the Node process, so the limit is
 * enforced *per instance*. With N instances behind a load balancer the
 * effective ceiling is N x limit, and a cold start clears the window. That is
 * a real weakness and this module is not a defence against a distributed
 * attacker.
 *
 * It is still worth having, because the thing being protected here is cost and
 * accidental hammering, not authentication. A stuck client retrying a receipt
 * scan in a loop, or one person discovering that `/api/expenses/ocr` is free to
 * call, is bounded by this. Moving to a shared store later means replacing
 * `consume()` and nothing else — every caller goes through it.
 *
 * If this grows into a real security control, back it with Redis (Upstash) or
 * an Appwrite table keyed the same way.
 */

export interface RateLimitRule {
  /** Maximum number of permitted requests inside the window. */
  readonly limit: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Requests still available under the tightest rule. */
  readonly remaining: number;
  /** Seconds until the caller may retry. Zero when allowed. */
  readonly retryAfterSeconds: number;
}

/**
 * Upper bound on tracked keys. Without it, spraying distinct IPs would grow the
 * map without limit and turn the limiter itself into the memory problem it is
 * meant to prevent. When the cap is hit the coldest third is dropped: an
 * attacker can still evict honest entries, but the cost of doing so is another
 * request under the same limits.
 */
const MAX_TRACKED_KEYS = 10_000;
const EVICTION_FRACTION = 3;

/** key -> ascending request timestamps inside the longest active window. */
const hits = new Map<string, number[]>();

function evictColdestKeys(): void {
  const target = Math.floor(MAX_TRACKED_KEYS / EVICTION_FRACTION);
  const byRecency = [...hits.entries()].sort(
    (a, b) => (a[1].at(-1) ?? 0) - (b[1].at(-1) ?? 0)
  );

  for (const [key] of byRecency.slice(0, target)) {
    hits.delete(key);
  }
}

/**
 * Record a request against `key` and report whether it is permitted.
 *
 * Rules are evaluated together, so a burst rule and a sustained rule can be
 * combined: `[{ limit: 10, windowMs: 60_000 }, { limit: 30, windowMs: 3_600_000 }]`
 * allows ten in any minute and thirty in any hour. A rejected request is *not*
 * recorded — being throttled must not extend the lockout.
 */
export function consume(
  key: string,
  rules: readonly RateLimitRule[]
): RateLimitResult {
  if (rules.length === 0) {
    return {
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
      retryAfterSeconds: 0,
    };
  }

  const now = Date.now();
  const longestWindow = Math.max(...rules.map((rule) => rule.windowMs));
  const recent = (hits.get(key) ?? []).filter(
    (timestamp) => now - timestamp < longestWindow
  );

  let retryAfterMs = 0;
  let remaining = Number.POSITIVE_INFINITY;

  for (const rule of rules) {
    const inWindow = recent.filter(
      (timestamp) => now - timestamp < rule.windowMs
    );
    remaining = Math.min(remaining, rule.limit - inWindow.length);

    if (inWindow.length >= rule.limit) {
      // The oldest hit in this window is the one that has to age out.
      const oldest = inWindow[0] ?? now;
      retryAfterMs = Math.max(retryAfterMs, oldest + rule.windowMs - now);
    }
  }

  if (retryAfterMs > 0) {
    // Persist the pruned list so the window keeps sliding while blocked.
    hits.set(key, recent);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_TRACKED_KEYS) {
    evictColdestKeys();
  }

  return {
    allowed: true,
    remaining: Math.max(0, remaining - 1),
    retryAfterSeconds: 0,
  };
}

/** Test seam — drops all recorded state. */
export function resetRateLimits(): void {
  hits.clear();
}

/**
 * Shared budgets, named so the intent is visible at the call site rather than
 * encoded as bare numbers in a route.
 */
export const RATE_LIMITS = {
  /**
   * Receipt OCR. Every call is a paid model invocation, so this is the tightest
   * budget in the app. Sized for the real workflow — someone sitting down to
   * file a stack of receipts in one go — not for a single submission: ten in a
   * minute absorbs the burst, forty in an hour is far past any honest session.
   */
  expenseOcr: [
    { limit: 10, windowMs: 60_000 },
    { limit: 40, windowMs: 3_600_000 },
  ],

  /**
   * Reimbursement submit. Each one generates a PDF and emails an approver, so
   * the cost of a loop here is landing in someone's inbox repeatedly.
   */
  expenseSubmit: [
    { limit: 10, windowMs: 60_000 },
    { limit: 60, windowMs: 3_600_000 },
  ],

  /** Draft autosave — cheap, but no reason to accept an unbounded write loop. */
  expenseDraft: [{ limit: 60, windowMs: 60_000 }],

  /**
   * Checkout. Deliberately loose: a buyer retrying a failed card must never be
   * told to come back later. This is a runaway-loop guard, nothing more.
   */
  checkout: [
    { limit: 15, windowMs: 60_000 },
    { limit: 60, windowMs: 3_600_000 },
  ],

  /** Anonymous form posts — the only fully public write path on the web app. */
  publicFormSubmit: [
    { limit: 5, windowMs: 60_000 },
    { limit: 30, windowMs: 3_600_000 },
  ],
} as const satisfies Record<string, readonly RateLimitRule[]>;
