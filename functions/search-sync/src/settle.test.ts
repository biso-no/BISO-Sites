import { describe, expect, it } from "bun:test";
import { DEFAULT_SETTLE_MS, settleDelayMs, settleFor } from "./settle";

describe("settleDelayMs", () => {
  it("defaults to 2 s", () => {
    expect(DEFAULT_SETTLE_MS).toBe(2000);
    expect(settleDelayMs(undefined)).toBe(2000);
    expect(settleDelayMs("")).toBe(2000);
  });

  it("reads a whole number of milliseconds, zero included", () => {
    expect(settleDelayMs("0")).toBe(0);
    expect(settleDelayMs("500")).toBe(500);
    expect(settleDelayMs(" 750 ")).toBe(750);
  });

  it("falls back to the default for anything else", () => {
    expect(settleDelayMs("-1")).toBe(2000);
    expect(settleDelayMs("1.5")).toBe(2000);
    expect(settleDelayMs("soon")).toBe(2000);
  });
});

describe("settleFor", () => {
  it("sleeps for the delay", async () => {
    const slept: number[] = [];
    const settle = settleFor(1500, (ms) => {
      slept.push(ms);
      return Promise.resolve();
    });
    await settle();
    expect(slept).toEqual([1500]);
  });

  it("does not sleep at all for zero", async () => {
    const slept: number[] = [];
    await settleFor(0, (ms) => {
      slept.push(ms);
      return Promise.resolve();
    })();
    expect(slept).toEqual([]);
  });
});
