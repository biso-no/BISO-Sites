import { describe, expect, it } from "vitest";
import {
  expandDepartmentName,
  getManagedCampuses,
  isNationalOperations,
  normalizeTeamName,
} from "./team-roles";

describe("expandDepartmentName", () => {
  it("expands camelCase to spaced words", () => {
    expect(expandDepartmentName("OperationsUnit")).toBe("Operations Unit");
    expect(expandDepartmentName("LedelsenOslo")).toBe("Ledelsen Oslo");
  });

  it("leaves already-expanded names alone", () => {
    expect(expandDepartmentName("Operations Unit")).toBe("Operations Unit");
  });
});

describe("normalizeTeamName", () => {
  it("strips legacy SG-App-Campus prefix", () => {
    expect(normalizeTeamName("SG-App-Campus-Oslo")).toEqual({
      kind: "campus",
      value: "Oslo",
    });
  });

  it("strips legacy SG-App-Dept prefix and expands camelCase", () => {
    expect(normalizeTeamName("SG-App-Dept-OperationsUnit")).toEqual({
      kind: "department",
      value: "Operations Unit",
    });
  });

  it("classifies known campus names as campus teams", () => {
    for (const campus of [
      "National",
      "Oslo",
      "Bergen",
      "Stavanger",
      "Trondheim",
    ]) {
      expect(normalizeTeamName(campus)).toEqual({
        kind: "campus",
        value: campus,
      });
    }
  });

  it("treats anything else as a department team", () => {
    expect(normalizeTeamName("Ledelsen Oslo")).toEqual({
      kind: "department",
      value: "Ledelsen Oslo",
    });
  });
});

describe("isNationalOperations", () => {
  it("requires both National campus and Operations Unit department", () => {
    expect(isNationalOperations(["National"], ["Operations Unit"])).toBe(true);
    expect(isNationalOperations(["National"], [])).toBe(false);
    expect(isNationalOperations([], ["Operations Unit"])).toBe(false);
    expect(isNationalOperations(["Oslo"], ["Operations Unit"])).toBe(false);
  });

  it("accepts the legacy camelCase department form", () => {
    expect(isNationalOperations(["National"], ["OperationsUnit"])).toBe(true);
  });
});

describe("getManagedCampuses", () => {
  it("requires both the campus team and its Ledelsen team", () => {
    expect(getManagedCampuses(["Oslo"], ["Ledelsen Oslo"])).toEqual(["Oslo"]);
    expect(getManagedCampuses(["Oslo"], [])).toEqual([]);
    expect(getManagedCampuses([], ["Ledelsen Oslo"])).toEqual([]);
  });

  it("accepts the legacy camelCase Ledelsen form", () => {
    expect(getManagedCampuses(["Bergen"], ["LedelsenBergen"])).toEqual([
      "Bergen",
    ]);
  });

  it("does not grant management of a different city", () => {
    expect(getManagedCampuses(["Oslo"], ["Ledelsen Bergen"])).toEqual([]);
  });

  it("handles multiple managed campuses", () => {
    expect(
      getManagedCampuses(
        ["Oslo", "Bergen"],
        ["Ledelsen Oslo", "LedelsenBergen"]
      )
    ).toEqual(["Oslo", "Bergen"]);
  });
});
