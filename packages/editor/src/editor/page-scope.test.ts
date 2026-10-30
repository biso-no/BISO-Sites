import { describe, expect, test } from "bun:test";
import {
  departmentsForCampus,
  metaAfterCampusChange,
  metaAfterUnitDepartmentChange,
  unitPageName,
} from "./page-scope";

const DEPARTMENTS = [
  { campusId: "1", id: "d-oslo", name: "OSL Fadderullan", theme: null },
  { campusId: "2", id: "d-bergen", name: "BRG Fadderullan", theme: null },
  { campusId: "5", id: "d-nat", name: "Wintergames", theme: null },
];

describe("departmentsForCampus", () => {
  test("lists only the departments of the chosen campus", () => {
    expect(departmentsForCampus(DEPARTMENTS, "2").map((d) => d.id)).toEqual([
      "d-bergen",
    ]);
  });

  test("lists nothing until a campus is chosen", () => {
    // The department list used to span every campus the editor could see,
    // so a global admin could pair a Bergen department with an Oslo page.
    expect(departmentsForCampus(DEPARTMENTS, "")).toEqual([]);
  });
});

describe("metaAfterCampusChange", () => {
  const meta = {
    campus: "1",
    department: "d-oslo",
    slug: "a",
    status: "draft" as const,
    title: "A",
  };

  test("drops a department that is not on the new campus", () => {
    expect(metaAfterCampusChange(meta, "2", DEPARTMENTS)).toEqual({
      ...meta,
      campus: "2",
      department: "",
    });
  });

  test("keeps a department that is on the new campus", () => {
    expect(
      metaAfterCampusChange(
        { ...meta, department: "d-bergen" },
        "2",
        DEPARTMENTS
      ).department
    ).toBe("d-bergen");
  });
});

const UNITS = [
  {
    campusId: "1",
    id: "d-oslo",
    name: "OSL Fadderullan",
    theme: null,
    unitSlug: "units/oslo/fadderullan",
  },
  {
    campusId: "1",
    id: "d-invest",
    name: "OSL Invest",
    theme: null,
    unitSlug: "units/oslo/invest",
  },
  { campusId: "1", id: "d-new", name: "OSL New", theme: null, unitSlug: null },
];

describe("unitPageName", () => {
  test("is the part of a sub-page's slug after its unit", () => {
    expect(
      unitPageName("units/oslo/fadderullan/program", "units/oslo/fadderullan")
    ).toBe("program");
  });

  test("is empty for a slug outside the unit", () => {
    expect(unitPageName("uten-navn", "units/oslo/fadderullan")).toBe("");
    expect(
      unitPageName("units/oslo/invest/program", "units/oslo/fadderullan")
    ).toBe("");
  });
});

describe("metaAfterUnitDepartmentChange", () => {
  const meta = {
    campus: "1",
    department: "d-oslo",
    slug: "units/oslo/fadderullan/program",
    status: "draft" as const,
    title: "Mitt program",
  };

  test("moves a sub-page's name under the new department's unit", () => {
    expect(metaAfterUnitDepartmentChange(meta, "d-invest", UNITS)).toEqual({
      ...meta,
      department: "d-invest",
      slug: "units/oslo/invest/program",
    });
  });

  test("names a page that isn't a sub-page yet from its title", () => {
    expect(
      metaAfterUnitDepartmentChange(
        { ...meta, department: "", slug: "uten-navn" },
        "d-oslo",
        UNITS
      ).slug
    ).toBe("units/oslo/fadderullan/mitt-program");
    expect(
      metaAfterUnitDepartmentChange(
        { ...meta, department: "", slug: "uten-navn", title: "!!!" },
        "d-oslo",
        UNITS
      ).slug
    ).toBe("units/oslo/fadderullan/side");
  });

  test("keeps the slug when the department has no unit address", () => {
    expect(metaAfterUnitDepartmentChange(meta, "d-new", UNITS)).toEqual({
      ...meta,
      department: "d-new",
    });
  });
});
