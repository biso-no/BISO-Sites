import { describe, expect, test } from "bun:test";
import { mapWithConcurrency } from "./concurrency";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("mapWithConcurrency", () => {
  test("returns results in input order, not completion order", async () => {
    const results = await mapWithConcurrency([30, 20, 10], 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });

    expect(results).toEqual([30, 20, 10]);
  });

  test("never runs more than `limit` tasks at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const gate = deferred();

    const run = mapWithConcurrency(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      async (value) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await gate.promise;
        inFlight -= 1;
        return value;
      }
    );

    // Every worker has started and is parked on the gate, so `peak` now holds
    // the real ceiling rather than whatever happened to overlap by timing.
    await Promise.resolve();
    gate.resolve();
    await run;

    expect(peak).toBe(3);
  });

  test("passes the index of each item to the mapper", async () => {
    const seen = await mapWithConcurrency(["a", "b", "c"], 2, (item, index) =>
      Promise.resolve(`${index}:${item}`)
    );

    expect(seen).toEqual(["0:a", "1:b", "2:c"]);
  });

  test("rejects with the first error and stops pulling new work", async () => {
    let started = 0;

    const run = mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      2,
      (value) => {
        started += 1;
        return value === 0
          ? Promise.reject(new Error("boom"))
          : Promise.resolve(value);
      }
    );

    await expect(run).rejects.toThrow("boom");
    expect(started).toBeLessThan(20);
  });

  test("handles an empty list without spawning workers", async () => {
    expect(await mapWithConcurrency([], 4, () => Promise.reject())).toEqual([]);
  });

  test("rejects a limit below 1 rather than hanging forever", async () => {
    await expect(
      mapWithConcurrency([1], 0, (value) => Promise.resolve(value))
    ).rejects.toThrow("at least 1");
  });
});
