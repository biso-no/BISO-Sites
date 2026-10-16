import { describe, expect, it } from "vitest";
import {
  isProjectUnit,
  PROJECT_UNIT_SLUGS,
  projectSlugForUnit,
  sortByCampusOrder,
} from "./project-units";

describe("projectSlugForUnit", () => {
  it("maps a project unit's slug to its hub route", () => {
    expect(projectSlugForUnit("fadderullan")).toBe("fadderullan");
    expect(projectSlugForUnit("karrieredagene")).toBe("karrieredagene");
    expect(projectSlugForUnit("wintergames")).toBe("winter-games");
    expect(projectSlugForUnit("bergensbanelopet")).toBe("bergensbanelopet");
  });

  it("does not mistake a sub-unit for the project", () => {
    expect(projectSlugForUnit("karrieredagene-marketing")).toBeNull();
    expect(projectSlugForUnit(null)).toBeNull();
    expect(projectSlugForUnit("")).toBeNull();
  });

  it("lists every hub exactly once", () => {
    expect(Object.keys(PROJECT_UNIT_SLUGS).sort()).toEqual([
      "bergensbanelopet",
      "fadderullan",
      "karrieredagene",
      "winter-games",
    ]);
  });
});

describe("isProjectUnit", () => {
  it("recognises a known project unit by slug even without a category", () => {
    // Trondheim's and Stavanger's project units have no `type` set.
    expect(isProjectUnit({ category: null, slug: "fadderullan" })).toBe(true);
  });

  it("recognises any unit categorised as a project", () => {
    expect(isProjectUnit({ category: "project", slug: "charity" })).toBe(true);
    expect(isProjectUnit({ category: "project", slug: null })).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isProjectUnit({ category: "society", slug: "case-club" })).toBe(
      false
    );
    expect(isProjectUnit({ category: null, slug: null })).toBe(false);
  });
});

describe("sortByCampusOrder", () => {
  it("orders Oslo, Bergen, Trondheim, Stavanger, National", () => {
    const sorted = sortByCampusOrder([
      { campusId: "5", name: "e" },
      { campusId: "4", name: "d" },
      { campusId: "2", name: "b" },
      { campusId: "1", name: "a" },
      { campusId: "3", name: "c" },
    ]);
    expect(sorted.map((unit) => unit.name)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("puts an unknown campus last without dropping it", () => {
    const sorted = sortByCampusOrder([
      { campusId: "9", name: "x" },
      { campusId: "1", name: "a" },
    ]);
    expect(sorted.map((unit) => unit.name)).toEqual(["a", "x"]);
  });

  it("does not mutate the input", () => {
    const input = [
      { campusId: "2", name: "b" },
      { campusId: "1", name: "a" },
    ];
    sortByCampusOrder(input);
    expect(input[0]?.name).toBe("b");
  });
});
