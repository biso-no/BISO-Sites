import { describe, expect, it } from "vitest";
import {
  firstParam,
  lastPageByOffset,
  lastReachablePage,
  MAX_OFFSET,
} from "./list-params";

describe("list-params primitives", () => {
  it("exposes Appwrite's offset ceiling", () => {
    expect(MAX_OFFSET).toBe(5000);
  });

  it("takes the first value of a repeated search param", () => {
    expect(firstParam({ q: ["a", "b"] }, "q")).toBe("a");
    expect(firstParam({ q: "solo" }, "q")).toBe("solo");
    expect(firstParam({}, "q")).toBeUndefined();
  });

  it("caps the last page at the offset ceiling, not the row count", () => {
    // 5000/12 = 416.67 -> 416 full pages, +1 for the partial page at the top.
    expect(lastPageByOffset(12)).toBe(417);
    // A million rows cannot outrun the ceiling.
    expect(lastReachablePage(1_000_000, 12)).toBe(417);
  });

  it("caps the last page at the row count when that is the tighter bound", () => {
    expect(lastReachablePage(25, 12)).toBe(3);
    expect(lastReachablePage(12, 12)).toBe(1);
  });

  it("never reports a last page below 1, even for an empty result", () => {
    expect(lastReachablePage(0, 12)).toBe(1);
  });
});
