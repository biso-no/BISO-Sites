/**
 * `inWaves` is what keeps a per-row read from becoming a per-row round trip.
 *
 * Two properties matter, and only one of them is about speed. The other is
 * that results come back in input order: callers index the output against the
 * input array, so a reordering attributes one row's answer to another and
 * reads as plausible data rather than as a bug.
 */

import { describe, expect, test } from "bun:test";
import { inWaves } from "./concurrency";

describe("inWaves", () => {
  test("keeps input order regardless of completion order", async () => {
    // Deliberately inverted: the first item resolves last.
    const out = await inWaves([40, 30, 20, 10], 4, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });
    expect(out).toEqual([40, 30, 20, 10]);
  });

  test("never exceeds the wave size, and does use it", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await inWaves(
      Array.from({ length: 20 }, (_, i) => i),
      4,
      (i) =>
        (async () => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          await Promise.resolve();
          inFlight--;
          return i;
        })()
    );
    expect(out).toHaveLength(20);
    expect(peak).toBe(4);
  });

  test("a wave size of one is still sequential", async () => {
    let peak = 0;
    let inFlight = 0;
    await inWaves([1, 2, 3], 1, (i) =>
      (async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        inFlight--;
        return i;
      })()
    );
    expect(peak).toBe(1);
  });

  test("an empty input does no work", async () => {
    expect(
      await inWaves([], 4, () => Promise.reject(new Error("called")))
    ).toEqual([]);
  });

  test("a wave size below one is refused rather than looping forever", async () => {
    await expect(inWaves([1], 0, async (i) => i)).rejects.toThrow(RangeError);
  });

  test("a rejection propagates rather than yielding a short result", async () => {
    await expect(
      inWaves([1, 2, 3], 2, (i) =>
        i === 2 ? Promise.reject(new Error("read failed")) : Promise.resolve(i)
      )
    ).rejects.toThrow("read failed");
  });
});
