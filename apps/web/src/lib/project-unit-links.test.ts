import { describe, expect, it } from "vitest";
import { careerDaysHrefs, findUnitHref } from "./project-unit-links";

const unit = (name: string, campusId: string, href: string) => ({
  campusId,
  href,
  name,
});

const UNITS = [
  unit("Karrieredagene", "1", "/units/oslo/karrieredagene"),
  unit("Karrieredagene", "4", "/units/stavanger/karrieredagene"),
  unit("Karrieredagene Marketing", "2", "/units/bergen/karrieredagene-marketing"),
  unit("Bergensbaneløpet", "1", "/units/oslo/bergensbanelopet"),
  unit("Case Club", "2", "/units/bergen/case-club"),
];

describe("findUnitHref", () => {
  it("finds a unit by its display name, ignoring case", () => {
    expect(findUnitHref(UNITS, "bergensbaneløpet")).toBe(
      "/units/oslo/bergensbanelopet"
    );
  });

  it("keeps to the requested campus", () => {
    expect(findUnitHref(UNITS, "Karrieredagene", "4")).toBe(
      "/units/stavanger/karrieredagene"
    );
  });

  it("does not mistake a sub-unit for the unit itself", () => {
    // Bergen has only "Karrieredagene Marketing"; linking the Bergen career
    // days card there would send companies to the wrong team.
    expect(findUnitHref(UNITS, "Karrieredagene", "2")).toBeNull();
  });

  it("returns null when no unit matches", () => {
    expect(findUnitHref(UNITS, "Inspire")).toBeNull();
    expect(findUnitHref([], "Karrieredagene", "1")).toBeNull();
  });
});

describe("careerDaysHrefs", () => {
  it("links each campus to its own career days unit", () => {
    const hrefs = careerDaysHrefs(UNITS);

    expect(hrefs.oslo).toBe("/units/oslo/karrieredagene");
    expect(hrefs.stavanger).toBe("/units/stavanger/karrieredagene");
  });

  it("falls back to the project page so no card is a dead end", () => {
    const hrefs = careerDaysHrefs(UNITS);

    expect(hrefs.bergen).toBe("/projects/karrieredagene");
    expect(hrefs.trondheim).toBe("/projects/karrieredagene");
  });
});
