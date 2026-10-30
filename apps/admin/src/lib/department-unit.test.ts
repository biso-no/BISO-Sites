import { describe, expect, test } from "bun:test";
import { departmentUnitSlug } from "./department-unit";

const fadderullan = {
  active: true,
  campus_id: "1",
  Name: "OSL Fadderullan",
  slug: "fadderullan",
};

describe("departmentUnitSlug", () => {
  test("a public, active unit's pages sit below its unit address", () => {
    expect(departmentUnitSlug(fadderullan)).toBe("units/oslo/fadderullan");
  });

  test("a unit the site doesn't serve has no address for pages", () => {
    // The public lookup wants `active: true`, so a null value doesn't count.
    expect(departmentUnitSlug({ ...fadderullan, active: null })).toBeNull();
    expect(departmentUnitSlug({ ...fadderullan, active: false })).toBeNull();
    expect(
      departmentUnitSlug({ ...fadderullan, Name: "HR", slug: "hr" })
    ).toBeNull();
    expect(
      departmentUnitSlug({ ...fadderullan, Name: "Drift Oslo", slug: "drift" })
    ).toBeNull();
  });

  test("a department without a slug has no address", () => {
    expect(departmentUnitSlug({ ...fadderullan, slug: null })).toBeNull();
  });
});
