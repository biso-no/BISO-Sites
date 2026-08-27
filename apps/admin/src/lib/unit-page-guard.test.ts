import { describe, expect, test } from "bun:test";
import {
  assertUnitPageBindingUnchanged,
  assertUnitPageNamespace,
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
   * This guard keys off the PERSISTED slug, so an ordinary page is outside its
   * remit entirely — including one whose incoming slug reaches into `units/`.
   * That case is NOT covered here and never was; assertUnitPageNamespace is
   * what rejects it, and the suite below is where that is proven.
   */
  test("keys off the persisted slug, so an ordinary page is unconstrained", () => {
    expect(
      assertUnitPageBindingUnchanged(
        { department_id: null, slug: null },
        { department: "308", slug: "units/oslo/fadderullan" }
      )
    ).toBeNull();
  });
});

const CLAIM_REFUSED = 'The "units/" address space belongs to department pages.';

describe("assertUnitPageNamespace", () => {
  test("leaves an ordinary slug alone, on create and on update", () => {
    expect(assertUnitPageNamespace(null, "about/history")).toBeNull();
    expect(assertUnitPageNamespace("about/junk", "about/history")).toBeNull();
    expect(assertUnitPageNamespace(null, "")).toBeNull();
    expect(assertUnitPageNamespace(null, "unitsomething")).toBeNull();
  });

  test("refuses a create that claims a unit slug", () => {
    expect(assertUnitPageNamespace(null, "units/oslo/fadderullan")).toContain(
      CLAIM_REFUSED
    );
  });

  /**
   * The two-step hijack: save an ordinary page, then rename it into the
   * namespace. A create-only check never sees this save.
   */
  test("refuses renaming an ordinary page into the namespace", () => {
    expect(
      assertUnitPageNamespace("about/junk", "units/oslo/fadderullan")
    ).toContain(CLAIM_REFUSED);
  });

  /**
   * Appwrite matches slugs case-insensitively, so a case variant serves the
   * very same public URL. It must be refused on both paths.
   */
  test("refuses a case-variant claim, on create and on rename", () => {
    expect(assertUnitPageNamespace(null, "Units/oslo/fadderullan")).toContain(
      CLAIM_REFUSED
    );
    expect(assertUnitPageNamespace(null, "UNITS/OSLO/X")).toContain(
      CLAIM_REFUSED
    );
    expect(
      assertUnitPageNamespace("about/junk", "Units/oslo/fadderullan")
    ).toContain(CLAIM_REFUSED);
  });

  /**
   * The caller (savePageEditorDoc in _actions/pages.ts) now trims the
   * incoming slug once, before it ever reaches this guard or storage — but
   * this guard is defended in depth via isUnitPageSlug's own trim, in case a
   * future caller forgets to normalize first. A padded slug like
   * " units/oslo/fadderullan" is reserved exactly like its trimmed form,
   * because that is the exact address it lands on once persisted
   * (resolveUniquePageSlug trims before writing).
   */
  test("refuses a padded slug, matching the trimmed form it would persist as", () => {
    expect(assertUnitPageNamespace(null, " units/oslo/fadderullan")).toContain(
      CLAIM_REFUSED
    );
    expect(assertUnitPageNamespace(null, "units/oslo/fadderullan ")).toContain(
      CLAIM_REFUSED
    );
    expect(assertUnitPageNamespace(null, " Units/oslo/x")).toContain(
      CLAIM_REFUSED
    );
    expect(
      assertUnitPageNamespace("about/junk", "  units/oslo/fadderullan  ")
    ).toContain(CLAIM_REFUSED);
  });

  test("lets a genuine unit page save its own unchanged slug", () => {
    expect(
      assertUnitPageNamespace(
        "units/oslo/fadderullan",
        "units/oslo/fadderullan"
      )
    ).toBeNull();
  });

  test("refuses a unit page re-pointing itself at another unit address", () => {
    expect(
      assertUnitPageNamespace("units/oslo/fadderullan", "units/oslo/noe-annet")
    ).toContain(CLAIM_REFUSED);
    // A pure case change is still a change to a different stored slug.
    expect(
      assertUnitPageNamespace(
        "units/oslo/fadderullan",
        "Units/oslo/fadderullan"
      )
    ).toContain(CLAIM_REFUSED);
  });

  /**
   * Renaming a unit page OUT of the namespace is not this rule's business —
   * the incoming slug claims nothing. assertUnitPageBindingUnchanged catches
   * it, as its own suite above asserts.
   */
  test("defers a rename out of the namespace to the binding guard", () => {
    expect(
      assertUnitPageNamespace("units/oslo/fadderullan", "about/history")
    ).toBeNull();
    expect(
      assertUnitPageBindingUnchanged(
        { department_id: "308", slug: "units/oslo/fadderullan" },
        { department: "308", slug: "about/history" }
      )
    ).toBe("A unit page's slug is managed by its department and cannot change");
  });
});
