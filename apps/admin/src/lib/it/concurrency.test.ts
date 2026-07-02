import { describe, expect, test } from "bun:test";
import { mapWithConcurrency } from "@repo/shared/utils/concurrency";

describe("mapWithConcurrency", () => {
  test("maps every item and preserves order", async () => {
    const result = await mapWithConcurrency(
      [1, 2, 3, 4, 5],
      2,
      async (n) => n * 10
    );
    expect(result).toEqual([10, 20, 30, 40, 50]);
  });

  test("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  test("returns empty array for empty input", async () => {
    expect(await mapWithConcurrency([], 3, async (n) => n)).toEqual([]);
  });
});
