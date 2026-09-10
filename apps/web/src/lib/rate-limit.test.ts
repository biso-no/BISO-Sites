import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientKeyFromHeaders, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows exactly the configured number of attempts in a window", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      expect(limiter.reserve("a").allowed).toBe(true);
    }

    expect(limiter.reserve("a").allowed).toBe(false);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("does not claim a slot when only checking", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    // A caller that checks and then bails (a validation error) must not have
    // spent its allowance.
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);

    limiter.reserve("a");
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("hands a slot to only one of a batch of simultaneous reservations", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    // `reserve` tests and claims in one synchronous step. A split
    // check-then-increment would let every caller here through, which is how a
    // parallel batch walks past the cap.
    const granted = [
      limiter.reserve("a"),
      limiter.reserve("a"),
      limiter.reserve("a"),
    ].filter((decision) => decision.allowed);

    expect(granted).toHaveLength(1);
  });

  it("reports the wait on a refused reservation, not just on check", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.reserve("a");

    vi.advanceTimersByTime(15_000);

    expect(limiter.reserve("a").retryAfterSeconds).toBe(45);
  });

  it("keeps separate counters per key", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    limiter.reserve("a");

    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("reopens once the window has elapsed", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.reserve("a");
    expect(limiter.check("a").allowed).toBe(false);

    vi.advanceTimersByTime(59_999);
    expect(limiter.check("a").allowed).toBe(false);

    vi.advanceTimersByTime(1);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("reports how long the caller must wait", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.reserve("a");

    vi.advanceTimersByTime(20_000);

    expect(limiter.check("a").retryAfterSeconds).toBe(40);
  });

  it("starts a fresh window rather than extending the old one", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.reserve("a");

    vi.advanceTimersByTime(60_000);

    // The expired window is replaced, so the earlier attempt does not count
    // against the new one.
    limiter.reserve("a");
    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("clientKeyFromHeaders", () => {
  it("takes the first hop from x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 198.51.100.1",
    });

    expect(clientKeyFromHeaders(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(
      clientKeyFromHeaders(new Headers({ "x-real-ip": "203.0.113.9" }))
    ).toBe("203.0.113.9");
  });

  it("returns null when no header identifies the caller", () => {
    // Never a shared bucket: one would let ordinary traffic exhaust a single
    // window and start turning genuine reports away.
    expect(clientKeyFromHeaders(new Headers())).toBeNull();
    expect(
      clientKeyFromHeaders(new Headers({ "x-forwarded-for": "  " }))
    ).toBeNull();
  });
});
