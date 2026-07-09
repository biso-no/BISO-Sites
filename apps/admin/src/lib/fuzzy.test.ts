import { describe, expect, test } from "bun:test";
import { fuzzyScore } from "./fuzzy";

describe("fuzzyScore", () => {
  test("returns null when characters are missing", () => {
    expect(fuzzyScore("xyz", "Feature flags")).toBeNull();
  });

  test("empty query matches everything with score 0", () => {
    expect(fuzzyScore("", "Anything")).toBe(0);
  });

  test("is case-insensitive", () => {
    expect(fuzzyScore("FLAG", "feature flags")).not.toBeNull();
  });

  test("prefix match scores higher than scattered match", () => {
    const prefix = fuzzyScore("feat", "Feature flags");
    const scattered = fuzzyScore("felg", "Feature flags");
    if (prefix === null || scattered === null) {
      throw new Error("both should match");
    }
    expect(prefix).toBeGreaterThan(scattered);
  });

  test("word-boundary match beats mid-word match", () => {
    const boundary = fuzzyScore("fl", "Feature flags");
    const midword = fuzzyScore("ea", "Feature flags");
    if (boundary === null || midword === null) {
      throw new Error("both should match");
    }
    expect(boundary).toBeGreaterThan(midword);
  });
});
