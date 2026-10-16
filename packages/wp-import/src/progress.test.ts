import { describe, expect, test } from "bun:test";
import { createProgressReporter, formatDuration } from "./progress";

/** Drives the reporter's clock by hand so throttling is deterministic. */
function fakeClock(startMs = 0) {
  let current = startMs;
  return {
    advance: (ms: number) => {
      current += ms;
    },
    now: () => current,
  };
}

describe("formatDuration", () => {
  test("renders sub-minute durations in whole seconds", () => {
    expect(formatDuration(45_000)).toBe("45s");
  });

  test("renders minutes with the remaining seconds", () => {
    expect(formatDuration(303_000)).toBe("5m 3s");
  });

  test("renders hours with the remaining minutes, dropping seconds", () => {
    expect(formatDuration(4_320_000)).toBe("1h 12m");
  });

  test("never renders a negative duration", () => {
    expect(formatDuration(-5000)).toBe("0s");
  });
});

describe("createProgressReporter", () => {
  test("stays quiet until the throttle interval has passed", () => {
    const lines: string[] = [];
    const clock = fakeClock();
    const reporter = createProgressReporter({
      intervalMs: 2000,
      label: "orders",
      log: (line) => lines.push(line),
      now: clock.now,
      total: 100,
    });

    clock.advance(500);
    reporter.record(true);
    reporter.record(true);

    expect(lines).toEqual([]);
  });

  test("emits a line once the interval elapses, with count, percent and rate", () => {
    const lines: string[] = [];
    const clock = fakeClock();
    const reporter = createProgressReporter({
      intervalMs: 2000,
      label: "orders",
      log: (line) => lines.push(line),
      now: clock.now,
      total: 100,
    });

    // One row every 100ms, so the throttle only lets the 20th row through.
    for (let i = 0; i < 20; i += 1) {
      clock.advance(100);
      reporter.record(true);
    }

    // 20 rows in 2s = 10 rows/s; 80 left at 10/s = ~8s remaining.
    expect(lines).toEqual(["  orders 20/100 (20%) — 10 rows/s, ~8s left"]);
  });

  test("reports failures only once there are some", () => {
    const lines: string[] = [];
    const clock = fakeClock();
    const reporter = createProgressReporter({
      intervalMs: 1000,
      label: "jobs",
      log: (line) => lines.push(line),
      now: clock.now,
      total: 10,
    });

    clock.advance(1000);
    reporter.record(false);
    reporter.record(true);

    expect(lines[0]).toContain("1 failed");
  });

  test("finish always emits, even when the throttle would have suppressed it", () => {
    const lines: string[] = [];
    const clock = fakeClock();
    const reporter = createProgressReporter({
      intervalMs: 60_000,
      label: "jobs",
      log: (line) => lines.push(line),
      now: clock.now,
      total: 2,
    });

    reporter.record(true);
    reporter.record(true);
    clock.advance(4000);
    reporter.finish();

    expect(lines).toEqual(["  jobs 2/2 (100%) — done in 4s"]);
  });

  test("does not divide by zero when nothing has completed yet", () => {
    const lines: string[] = [];
    const clock = fakeClock();
    const reporter = createProgressReporter({
      label: "orders",
      log: (line) => lines.push(line),
      now: clock.now,
      total: 100,
    });

    reporter.finish();

    expect(lines).toEqual(["  orders 0/100 (0%) — done in 0s"]);
  });

  test("omits the ETA while the rate is still unknown", () => {
    const lines: string[] = [];
    const clock = fakeClock();
    const reporter = createProgressReporter({
      intervalMs: 0,
      label: "orders",
      log: (line) => lines.push(line),
      now: clock.now,
      total: 100,
    });

    // No time has passed, so rows/s is meaningless — reporting "~Infinity"
    // or "~0s left" would both be lies.
    reporter.record(true);

    expect(lines[0]).toBe("  orders 1/100 (1%)");
  });

  test("treats a zero total as complete rather than dividing by it", () => {
    const lines: string[] = [];
    const reporter = createProgressReporter({
      label: "products",
      log: (line) => lines.push(line),
      now: fakeClock().now,
      total: 0,
    });

    reporter.finish();

    expect(lines).toEqual(["  products 0/0 (100%) — done in 0s"]);
  });
});
