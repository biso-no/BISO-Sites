import { describe, expect, test } from "bun:test";
import { CAMPUS_SEGMENTS } from "@repo/shared/utils/unit-urls";
import { CAMPUS_ID_TO_NAME, CAMPUS_NAME_TO_ID } from "./campus-constants";
import {
  assignUnitSlugs,
  canManageDepartment,
  resolveDepartmentsLanding,
  uniqueUnitSlug,
  unitSlug,
} from "./departments";

describe("unitSlug", () => {
  test("strips the campus prefix so all campuses share one slug", () => {
    expect(unitSlug("OSL Fadderullan")).toBe("fadderullan");
    expect(unitSlug("BRG Fadderullan")).toBe("fadderullan");
    expect(unitSlug("TRD Fadderullan")).toBe("fadderullan");
    expect(unitSlug("STV Fadderullan")).toBe("fadderullan");
  });

  test("folds Norwegian characters using the existing convention", () => {
    expect(unitSlug("BRG Næringsliv")).toBe("naeringsliv");
    expect(unitSlug("TRD Økonomi")).toBe("okonomi");
    expect(unitSlug("OSL Påvirkning")).toBe("pavirkning");
  });

  test("hyphenates multi-word names and collapses punctuation runs", () => {
    expect(unitSlug("TRD Sosialt Utvalg")).toBe("sosialt-utvalg");
    expect(unitSlug("OSL DIGI-KOMM - Digital")).toBe("digi-komm-digital");
  });

  test("drops the nedlagt suffix carried by closed units", () => {
    expect(unitSlug("OSL DataAnalytisk Utvalg - nedlagt")).toBe(
      "dataanalytisk-utvalg"
    );
  });

  test("leaves unprefixed national names alone", () => {
    expect(unitSlug("Sentralt utvalg")).toBe("sentralt-utvalg");
  });

  test("never returns an empty slug", () => {
    expect(unitSlug("!!!")).toBe("unit");
    expect(unitSlug("")).toBe("unit");
  });
});

describe("uniqueUnitSlug", () => {
  test("returns the base when free", () => {
    expect(uniqueUnitSlug("fadderullan", new Set())).toBe("fadderullan");
  });

  test("suffixes from 2 upward on collision", () => {
    expect(uniqueUnitSlug("fadderullan", new Set(["fadderullan"]))).toBe(
      "fadderullan-2"
    );
    expect(
      uniqueUnitSlug("fadderullan", new Set(["fadderullan", "fadderullan-2"]))
    ).toBe("fadderullan-3");
  });
});

describe("campus table drift guard", () => {
  test("unit-urls campus ids match campus-constants", () => {
    expect(Object.keys(CAMPUS_SEGMENTS).sort()).toEqual(
      Object.values(CAMPUS_NAME_TO_ID).sort()
    );
  });

  test("unit-urls campus labels match campus-constants names", () => {
    for (const [id, entry] of Object.entries(CAMPUS_SEGMENTS)) {
      expect(entry.label).toBe(CAMPUS_ID_TO_NAME[id] as string);
    }
  });
});

describe("assignUnitSlugs", () => {
  test("assigns one slug per active department", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
        { $id: "612", campusId: "3", name: "TRD Sosialt Utvalg", active: true },
      ]
    );
    expect(assigned.get("308")).toBe("fadderullan");
    expect(assigned.get("612")).toBe("sosialt-utvalg");
  });

  test("the same name in different campuses does NOT collide", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
        { $id: "410", campusId: "2", name: "BRG Fadderullan", active: true },
        { $id: "705", campusId: "3", name: "TRD Fadderullan", active: true },
      ]
    );
    expect(assigned.get("308")).toBe("fadderullan");
    expect(assigned.get("410")).toBe("fadderullan");
    expect(assigned.get("705")).toBe("fadderullan");
  });

  test("the same name WITHIN one campus is suffixed", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
        { $id: "309", campusId: "1", name: "OSL Fadderullan", active: true },
      ]
    );
    expect(assigned.get("308")).toBe("fadderullan");
    expect(assigned.get("309")).toBe("fadderullan-2");
  });

  test("never rewrites a slug that is already assigned", () => {
    const assigned = assignUnitSlugs(
      [{ $id: "308", campus_id: "1", slug: "fadderullan" }],
      [
        {
          $id: "308",
          campusId: "1",
          name: "OSL Fadderullan 2026",
          active: true,
        },
      ]
    );
    expect(assigned.has("308")).toBe(false);
  });

  test("existing rows carrying slug: null are treated as unslugged", () => {
    const assigned = assignUnitSlugs(
      [{ $id: "308", campus_id: "1", slug: null }],
      [{ $id: "308", campusId: "1", name: "OSL Fadderullan", active: true }]
    );
    expect(assigned.get("308")).toBe("fadderullan");
  });

  test("respects slugs already taken in the same campus", () => {
    const assigned = assignUnitSlugs(
      [{ $id: "308", campus_id: "1", slug: "fadderullan" }],
      [{ $id: "309", campusId: "1", name: "OSL Fadderullan", active: true }]
    );
    expect(assigned.get("309")).toBe("fadderullan-2");
  });

  test("an existing slug at one campus does not block the same slug at another campus", () => {
    const assigned = assignUnitSlugs(
      [{ $id: "308", campus_id: "1", slug: "fadderullan" }],
      [{ $id: "410", campusId: "2", name: "BRG Fadderullan", active: true }]
    );
    expect(assigned.get("410")).toBe("fadderullan");
  });

  test("skips inactive departments so a closed unit cannot hold the slug", () => {
    const assigned = assignUnitSlugs(
      [],
      [
        {
          $id: "300",
          campusId: "1",
          name: "OSL Fadderullan - nedlagt",
          active: false,
        },
        { $id: "308", campusId: "1", name: "OSL Fadderullan", active: true },
      ]
    );
    expect(assigned.has("300")).toBe(false);
    expect(assigned.get("308")).toBe("fadderullan");
  });
});

describe("resolveDepartmentsLanding", () => {
  test("admins get the full listing", () => {
    expect(
      resolveDepartmentsLanding({
        roles: ["globaladmin"],
        resolvedDepartmentIds: [],
      })
    ).toEqual({ kind: "listing" });
    expect(
      resolveDepartmentsLanding({
        roles: ["campusadmin"],
        resolvedDepartmentIds: ["308"],
      })
    ).toEqual({ kind: "listing" });
  });

  test("a single-department user is redirected to it", () => {
    expect(
      resolveDepartmentsLanding({ roles: [], resolvedDepartmentIds: ["308"] })
    ).toEqual({ kind: "redirect", departmentId: "308" });
  });

  test("a multi-department user gets a listing scoped to their own", () => {
    expect(
      resolveDepartmentsLanding({
        roles: [],
        resolvedDepartmentIds: ["308", "417"],
      })
    ).toEqual({ kind: "listing", scopeIds: ["308", "417"] });
  });

  test("team membership with zero resolved ids is forbidden, not a listing", () => {
    expect(
      resolveDepartmentsLanding({ roles: [], resolvedDepartmentIds: [] })
    ).toEqual({ kind: "forbidden" });
  });
});

describe("canManageDepartment", () => {
  const oslo = { $id: "308", campus_id: "1" };

  test("a global admin manages any department", () => {
    expect(
      canManageDepartment(
        {
          roles: ["globaladmin"],
          managedCampusIds: [],
          resolvedDepartmentIds: [],
        },
        oslo
      )
    ).toBe(true);
  });

  test("a campus admin manages departments in their campus only", () => {
    const ctx = {
      roles: ["campusadmin"],
      managedCampusIds: ["1"],
      resolvedDepartmentIds: [],
    };
    expect(canManageDepartment(ctx, oslo)).toBe(true);
    expect(canManageDepartment(ctx, { $id: "410", campus_id: "2" })).toBe(
      false
    );
  });

  test("a department member manages their own department only", () => {
    const ctx = {
      roles: [],
      managedCampusIds: [],
      resolvedDepartmentIds: ["308"],
    };
    expect(canManageDepartment(ctx, oslo)).toBe(true);
    expect(canManageDepartment(ctx, { $id: "417", campus_id: "1" })).toBe(
      false
    );
  });

  test("grants are a union: a campus admin also on a cross-campus board keeps both", () => {
    const ctx = {
      roles: ["campusadmin"],
      managedCampusIds: ["1"],
      resolvedDepartmentIds: ["410"],
    };
    expect(canManageDepartment(ctx, oslo)).toBe(true);
    expect(canManageDepartment(ctx, { $id: "410", campus_id: "2" })).toBe(true);
    expect(canManageDepartment(ctx, { $id: "999", campus_id: "3" })).toBe(
      false
    );
  });
});
