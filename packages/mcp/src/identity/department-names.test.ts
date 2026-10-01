/**
 * Department name matching.
 *
 * These cases are the reason the module exists: the team name is a lossy
 * derivation of the stored name, and an equality test silently resolves
 * nothing for every campus-prefixed department. The round-trip helper below
 * reproduces the derivation exactly rather than asserting on hand-written
 * strings, so the tests stay true if the naming convention moves.
 */

import { describe, expect, test } from "bun:test";
import { expandDepartmentName } from "@repo/shared/utils/team-roles";
import {
  CAMPUS_PREFIX_TO_ID,
  departmentNameMatch,
  departmentNameMatcher,
} from "./department-names";

const WHITESPACE = /\s+/g;
const NUMERIC = /^\d+$/;

/**
 * The exact derivation the repo performs: `it-users.ts` builds the Azure group
 * name by deleting whitespace, and `parseTeamMemberships` reads it back through
 * `expandDepartmentName`.
 */
function teamNameFor(storedName: string): string {
  return expandDepartmentName(storedName.replace(WHITESPACE, ""));
}

function row(id: string, Name: string, campusId: string) {
  return { $id: id, Name, campus_id: campusId };
}

function matches(
  teamName: string,
  candidate: { Name: string; campus_id: string | null }
) {
  return (
    departmentNameMatch(departmentNameMatcher(teamName), candidate) !== null
  );
}

describe("the team-name round trip", () => {
  test("is lossy for campus-prefixed names", () => {
    // If this ever becomes lossless the matcher can be simplified; until then
    // it is the whole justification for not using an equality query.
    expect(teamNameFor("OSL Fadderullan")).toBe("OSLFadderullan");
    expect(teamNameFor("TRD Sosialt Utvalg")).toBe("TRDSosialt Utvalg");
  });

  test("is lossless for unprefixed camel-case names", () => {
    expect(teamNameFor("Operations Unit")).toBe("Operations Unit");
    expect(teamNameFor("Ledelsen Oslo")).toBe("Ledelsen Oslo");
  });
});

describe("departmentNameMatch", () => {
  test("matches a campus-prefixed department through the lossy round trip", () => {
    expect(
      matches(teamNameFor("OSL Fadderullan"), row("d1", "OSL Fadderullan", "1"))
    ).toBe(true);
  });

  test("matches a multi-word campus-prefixed department", () => {
    expect(
      matches(
        teamNameFor("TRD Sosialt Utvalg"),
        row("d2", "TRD Sosialt Utvalg", "3")
      )
    ).toBe(true);
  });

  test("does not match the same unit at another campus", () => {
    const team = teamNameFor("OSL Fadderullan");
    expect(matches(team, row("d3", "TRD Fadderullan", "3"))).toBe(false);
    expect(matches(team, row("d4", "BRG Fadderullan", "2"))).toBe(false);
  });

  test("does not match a different unit at the same campus", () => {
    expect(
      matches(
        teamNameFor("OSL Fadderullan"),
        row("d5", "OSL Sosialt Utvalg", "1")
      )
    ).toBe(false);
  });

  test("still matches unprefixed national departments", () => {
    expect(
      matches(teamNameFor("Operations Unit"), row("d6", "Operations Unit", "5"))
    ).toBe(true);
  });

  test("ignores the closure marker", () => {
    expect(
      matches(
        teamNameFor("OSL Fadderullan"),
        row("d7", "OSL Fadderullan - nedlagt", "1")
      )
    ).toBe(true);
  });

  test("folds Norwegian diacritics", () => {
    expect(
      matches(teamNameFor("OSL Påvirkning"), row("d8", "OSL Pavirkning", "1"))
    ).toBe(true);
  });

  test("refuses a row with no campus when the campus must be checked", () => {
    // "Fadderullan" alone is ambiguous across campuses, so a row that cannot
    // confirm its campus is not a match.
    expect(
      matches("OSLFadderullan", { Name: "Fadderullan", campus_id: null })
    ).toBe(false);
  });

  test("refuses a row with a blank or missing name", () => {
    const team = teamNameFor("OSL Fadderullan");
    expect(matches(team, { Name: "  ", campus_id: "1" })).toBe(false);
    expect(
      departmentNameMatch(departmentNameMatcher(team), {
        Name: null,
        campus_id: "1",
      })
    ).toBeNull();
  });

  test("keeps case-only distinctions that whitespace deletion would collapse", () => {
    // "Oslo Noe" and "OSL O Noe" both become "oslonoe" once folded, but their
    // team names differ ("OsloNoe" vs "OSLONoe"), so the strict key must keep
    // them apart or one unit would inherit the other's scope.
    expect(matches("Oslo Noe", row("d9", "OSL O Noe", "1"))).toBe(false);
    expect(matches("Oslo Noe", row("d10", "Oslo Noe", "1"))).toBe(true);
  });

  test("reports a strict match as strict and a folded one as folded", () => {
    expect(
      departmentNameMatch(
        departmentNameMatcher(teamNameFor("Operations Unit")),
        row("d11", "Operations Unit", "5")
      )
    ).toBe("strict");
    expect(
      departmentNameMatch(
        departmentNameMatcher("OSLPÅVIRKNING"),
        row("d12", "OSL Pavirkning", "1")
      )
    ).toBe("folded");
  });

  test("every campus prefix maps to a numeric campus id", () => {
    for (const id of Object.values(CAMPUS_PREFIX_TO_ID)) {
      expect(id).toMatch(NUMERIC);
    }
  });
});
