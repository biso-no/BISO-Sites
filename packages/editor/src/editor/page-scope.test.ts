import { describe, expect, test } from "bun:test";
import { departmentsForCampus, metaAfterCampusChange } from "./page-scope";

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
