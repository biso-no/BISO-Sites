import { describe, expect, test } from "bun:test";
import {
  normalizeFlagKey,
  validateFeatureFlagInput,
} from "./feature-flags-model";

describe("normalizeFlagKey", () => {
  test("lowercases and trims", () => {
    expect(normalizeFlagKey("  New_Checkout  ")).toBe("new_checkout");
  });
});

describe("validateFeatureFlagInput", () => {
  test("accepts and normalizes a valid flag", () => {
    const result = validateFeatureFlagInput({
      key: "  New_Checkout ",
      title: "  New checkout  ",
      description: "  Rolls out the new flow  ",
      enabled: true,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        key: "new_checkout",
        title: "New checkout",
        description: "Rolls out the new flow",
        enabled: true,
      },
    });
  });

  test("defaults enabled to false and description to null", () => {
    const result = validateFeatureFlagInput({ key: "beta", title: "Beta" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.enabled).toBe(false);
      expect(result.value.description).toBeNull();
    }
  });

  test("treats a whitespace-only description as null", () => {
    const result = validateFeatureFlagInput({
      key: "beta",
      title: "Beta",
      description: "   ",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toBeNull();
    }
  });

  test("rejects an empty key", () => {
    expect(validateFeatureFlagInput({ key: "  ", title: "X" })).toEqual({
      ok: false,
      error: "Key is required",
    });
  });

  test("rejects keys with spaces or illegal characters", () => {
    expect(
      validateFeatureFlagInput({ key: "new checkout", title: "X" }).ok
    ).toBe(false);
    expect(validateFeatureFlagInput({ key: "flag!", title: "X" }).ok).toBe(
      false
    );
    expect(validateFeatureFlagInput({ key: "-leading", title: "X" }).ok).toBe(
      false
    );
  });

  test("rejects an over-long key", () => {
    const result = validateFeatureFlagInput({
      key: "a".repeat(65),
      title: "X",
    });
    expect(result.ok).toBe(false);
  });

  test("rejects an empty title", () => {
    expect(validateFeatureFlagInput({ key: "beta", title: "   " })).toEqual({
      ok: false,
      error: "Title is required",
    });
  });

  test("rejects an over-long title", () => {
    const result = validateFeatureFlagInput({
      key: "beta",
      title: "x".repeat(121),
    });
    expect(result.ok).toBe(false);
  });
});
