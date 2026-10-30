import { describe, expect, it } from "bun:test";
import { memoizeSource } from "./cached-source";
import type { PrivateValueSource } from "./types";

const source: PrivateValueSource = { get: () => Promise.resolve({}) };

describe("memoizeSource", () => {
  it("builds the source once across requests", () => {
    let built = 0;
    const get = memoizeSource(() => {
      built += 1;
      return source;
    });
    expect(get()).toBe(source);
    expect(get()).toBe(source);
    expect(built).toBe(1);
  });

  it("remembers a null source", () => {
    let built = 0;
    const get = memoizeSource(() => {
      built += 1;
      return null;
    });
    get();
    get();
    expect(built).toBe(1);
  });

  it("does not cache a throw", () => {
    let built = 0;
    const get = memoizeSource(() => {
      built += 1;
      if (built === 1) {
        throw new Error("config");
      }
      return source;
    });
    expect(() => get()).toThrow("config");
    expect(get()).toBe(source);
  });
});
