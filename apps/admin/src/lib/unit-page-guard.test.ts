import { describe, expect, test } from "bun:test";
import { assertUnitPageBindingUnchanged } from "./unit-page-guard";

const persisted = {
  department_id: "308",
  slug: "units/oslo/fadderullan",
};

describe("assertUnitPageBindingUnchanged", () => {
  test("allows a save that leaves the binding alone", () => {
    expect(
      assertUnitPageBindingUnchanged(persisted, {
        department: "308",
        slug: "units/oslo/fadderullan",
      })
    ).toBeNull();
  });

  test("rejects a slug change on a unit page", () => {
    expect(
      assertUnitPageBindingUnchanged(persisted, {
        department: "308",
        slug: "units/oslo/noe-annet",
      })
    ).toBe("A unit page's slug is managed by its department and cannot change");
  });

  test("rejects a department change on a unit page", () => {
    expect(
      assertUnitPageBindingUnchanged(persisted, {
        department: "410",
        slug: "units/oslo/fadderullan",
      })
    ).toBe(
      "A unit page's department is managed by its department and cannot change"
    );
  });

  test("leaves ordinary pages completely unconstrained", () => {
    expect(
      assertUnitPageBindingUnchanged(
        { department_id: "308", slug: "about/history" },
        { department: "410", slug: "about/something-else" }
      )
    ).toBeNull();
  });

  test("treats a page with no persisted slug as ordinary", () => {
    expect(
      assertUnitPageBindingUnchanged(
        { department_id: null, slug: null },
        { department: "308", slug: "units/oslo/fadderullan" }
      )
    ).toBeNull();
  });
});
