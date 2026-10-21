import { describe, expect, it } from "vitest";
import {
  compareVersions,
  isVersionString,
  policyFromRow,
  validateAppVersionPolicy,
} from "./app-versions";

describe("isVersionString", () => {
  it("accepts major.minor.patch", () => {
    expect(isVersionString("2.4.0")).toBe(true);
    expect(isVersionString("10.0.12")).toBe(true);
  });
  it("rejects anything else", () => {
    for (const v of ["2.4", "2.4.0+93", "v2.4.0", "2.4.0-beta", "", " 2.4.0"]) {
      expect(isVersionString(v)).toBe(false);
    }
  });
});

describe("compareVersions", () => {
  it("compares segments numerically", () => {
    expect(compareVersions("2.10.0", "2.9.0")).toBeGreaterThan(0);
    expect(compareVersions("2.2.9", "2.3.0")).toBeLessThan(0);
    expect(compareVersions("2.4.0", "2.4.0")).toBe(0);
  });
});

describe("validateAppVersionPolicy", () => {
  it("turns blanks into null", () => {
    expect(validateAppVersionPolicy({ minimum: " ", recommended: "" })).toEqual(
      { policy: { minimum: null, recommended: null } }
    );
  });
  it("trims and accepts recommended >= minimum", () => {
    expect(
      validateAppVersionPolicy({ minimum: " 2.4.0 ", recommended: "2.4.1" })
    ).toEqual({ policy: { minimum: "2.4.0", recommended: "2.4.1" } });
  });
  it("names the bad field", () => {
    expect(
      validateAppVersionPolicy({ minimum: "2.4", recommended: "" })
    ).toEqual({ error: "invalidMinimum" });
    expect(validateAppVersionPolicy({ minimum: "", recommended: "x" })).toEqual(
      { error: "invalidRecommended" }
    );
  });
  it("rejects recommended below minimum", () => {
    expect(
      validateAppVersionPolicy({ minimum: "2.4.0", recommended: "2.3.9" })
    ).toEqual({ error: "recommendedBelowMinimum" });
  });
});

describe("policyFromRow", () => {
  it("drops stored values that are not versions", () => {
    expect(
      policyFromRow({
        platform: "ios",
        minimum_version: "2.4.0",
        recommended_version: "soon",
      })
    ).toEqual({ minimum: "2.4.0", recommended: null });
    expect(policyFromRow(null)).toEqual({ minimum: null, recommended: null });
  });
});
