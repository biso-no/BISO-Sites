import { describe, expect, it } from "vitest";
import { safeSecretCompare } from "./secrets";

describe("safeSecretCompare", () => {
  it("matches identical secrets", () => {
    expect(safeSecretCompare("super-secret-token", "super-secret-token")).toBe(
      true
    );
  });

  it("rejects different secrets of equal length", () => {
    expect(safeSecretCompare("aaaaaaaa", "aaaaaaab")).toBe(false);
  });

  it("rejects secrets of different length", () => {
    expect(safeSecretCompare("short", "a-much-longer-secret")).toBe(false);
  });

  it("rejects null, undefined, and empty candidates", () => {
    expect(safeSecretCompare(null, "secret")).toBe(false);
    expect(safeSecretCompare(undefined, "secret")).toBe(false);
    expect(safeSecretCompare("", "secret")).toBe(false);
  });

  it("is byte-exact (no trimming or case folding)", () => {
    expect(safeSecretCompare("secret ", "secret")).toBe(false);
    expect(safeSecretCompare("Secret", "secret")).toBe(false);
  });
});
