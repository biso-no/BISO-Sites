import { describe, expect, test } from "bun:test";
import {
  assertUnitPageBindingUnchanged,
  assertUnitPageCreationAllowed,
} from "./unit-page-guard";

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

  /**
   * This guard only ever sees a PERSISTED row, so it cannot defend the
   * `units/` namespace against a brand-new page claiming a slug inside it —
   * that is assertUnitPageCreationAllowed's job, below. Keeping the case here
   * documents the split rather than the hole it used to be.
   */
  test("cannot judge a page with no persisted slug — creation guard's job", () => {
    expect(
      assertUnitPageBindingUnchanged(
        { department_id: null, slug: null },
        { department: "308", slug: "units/oslo/fadderullan" }
      )
    ).toBeNull();
  });
});

describe("assertUnitPageCreationAllowed", () => {
  test("leaves an ordinary new page unconstrained", () => {
    expect(assertUnitPageCreationAllowed("about/history")).toBeNull();
    expect(assertUnitPageCreationAllowed("")).toBeNull();
    expect(assertUnitPageCreationAllowed(null)).toBeNull();
    expect(assertUnitPageCreationAllowed("unitsomething")).toBeNull();
  });

  test("refuses a new page claiming a slug in the units/ namespace", () => {
    expect(assertUnitPageCreationAllowed("units/oslo/fadderullan")).toContain(
      "created from its department page"
    );
  });

  test("refuses the namespace prefix itself and any depth under it", () => {
    expect(assertUnitPageCreationAllowed("units/")).not.toBeNull();
    expect(assertUnitPageCreationAllowed("units/oslo")).not.toBeNull();
    expect(
      assertUnitPageCreationAllowed("units/oslo/fadderullan/extra")
    ).not.toBeNull();
  });
});
