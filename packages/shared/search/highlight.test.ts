import { describe, expect, it } from "vitest";
import { hasMatch, toSegments } from "./highlight";

describe("toSegments", () => {
  it("splits marked text", () => {
    expect(toSegments("\u0001Winter\u0002 Games")).toEqual([
      { text: "Winter", match: true },
      { text: " Games", match: false },
    ]);
  });

  it("handles plain and empty text", () => {
    expect(toSegments("plain")).toEqual([{ text: "plain", match: false }]);
    expect(toSegments("")).toEqual([]);
  });

  it("treats HTML tags in content as text", () => {
    expect(toSegments("<em>not a tag</em> \u0001x\u0002")).toEqual([
      { text: "<em>not a tag</em> ", match: false },
      { text: "x", match: true },
    ]);
  });

  it("merges adjacent same-kind segments and drops empty ones", () => {
    expect(toSegments("\u0001a\u0002\u0001b\u0002 c\u0001\u0002")).toEqual([
      { text: "ab", match: true },
      { text: " c", match: false },
    ]);
  });

  it("detects matches", () => {
    expect(hasMatch(toSegments("a \u0001b\u0002"))).toBe(true);
    expect(hasMatch(toSegments("a b"))).toBe(false);
  });
});
