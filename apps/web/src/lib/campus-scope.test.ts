import { describe, expect, it } from "vitest";
import { campusScopeIds, NATIONAL_CAMPUS_ID } from "./campus-scope";

describe("campusScopeIds", () => {
  it("does not filter when no campus is selected", () => {
    expect(campusScopeIds(null)).toBeNull();
    expect(campusScopeIds(undefined)).toBeNull();
    expect(campusScopeIds("")).toBeNull();
  });

  it("does not filter for the explicit all-campuses selection", () => {
    expect(campusScopeIds("all")).toBeNull();
  });

  it("pairs a study campus with National", () => {
    expect(campusScopeIds("1")).toEqual(["1", NATIONAL_CAMPUS_ID]);
    expect(campusScopeIds("2")).toEqual(["2", NATIONAL_CAMPUS_ID]);
  });

  it("does not duplicate National when National is selected", () => {
    expect(campusScopeIds(NATIONAL_CAMPUS_ID)).toEqual([NATIONAL_CAMPUS_ID]);
  });

  it("excludes campuses other than the selected one and National", () => {
    const scope = campusScopeIds("2");
    expect(scope).not.toContain("1");
    expect(scope).toHaveLength(2);
  });
});
