import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAMPUS_CITY_NAMES } from "@repo/shared/utils/team-roles";
import {
  CAMPUS_ADMIN_TEAM_IDS,
  DOCS_HANDOVER_TEAM_ID,
  docsAccessFromTeams,
  GLOBAL_ADMIN_TEAM_IDS,
} from "./access";

const team = ($id: string, name = "Any name") => ({ $id, name });

/** `sanitizeTeamId` in m365-sync.ts: returns its argument, lowercased. */
const SANITIZE_TEAM_ID =
  /function sanitizeTeamId\((\w+): string\): string \{\s*return (\w+)\.toLowerCase\(\);\s*\}/;

/** Ids a user picks when creating their own team. */
const randomId = () => `user-${crypto.randomUUID().slice(0, 8)}`;

describe("docsAccessFromTeams", () => {
  it("grants globaladmin for the National + Operations Unit team ids", () => {
    expect(
      docsAccessFromTeams([
        team("sg-app-campus-national", "National"),
        team("sg-app-dept-operationsunit", "Operations Unit"),
      ])
    ).toBe("globaladmin");
  });

  it("grants campusadmin for a campus id + the matching Ledelsen id", () => {
    for (const { campus, department } of CAMPUS_ADMIN_TEAM_IDS) {
      expect(docsAccessFromTeams([team(campus), team(department)])).toBe(
        "campusadmin"
      );
    }
    expect(
      docsAccessFromTeams([
        team("sg-app-campus-oslo", "Oslo"),
        team("sg-app-dept-ledelsenoslo", "Ledelsen Oslo"),
      ])
    ).toBe("campusadmin");
  });

  it("denies a campus with another city's Ledelsen", () => {
    expect(
      docsAccessFromTeams([
        team("sg-app-campus-oslo"),
        team("sg-app-dept-ledelsenbergen"),
      ])
    ).toBeNull();
  });

  it("denies half a pair", () => {
    expect(docsAccessFromTeams([team("sg-app-campus-national")])).toBeNull();
    expect(
      docsAccessFromTeams([team("sg-app-dept-operationsunit")])
    ).toBeNull();
    expect(docsAccessFromTeams([team("sg-app-dept-ledelsenoslo")])).toBeNull();
  });

  it("denies a department-only HR member", () => {
    expect(docsAccessFromTeams([team("sg-app-dept-hr", "HR")])).toBeNull();
  });

  it("denies National + HR (not operations)", () => {
    expect(
      docsAccessFromTeams([
        team("sg-app-campus-national"),
        team("sg-app-dept-hr"),
      ])
    ).toBeNull();
  });

  it("denies user-created teams that copy the global admin names", () => {
    for (const names of [
      ["SG-App-Campus-National", "SG-App-Dept-OperationsUnit"],
      ["National", "Operations Unit"],
      ["National", "OperationsUnit"],
    ]) {
      expect(
        docsAccessFromTeams(names.map((name) => team(randomId(), name)))
      ).toBeNull();
    }
  });

  it("denies user-created teams that copy the campus admin names", () => {
    for (const names of [
      ["SG-App-Campus-Oslo", "SG-App-Dept-LedelsenOslo"],
      ["Oslo", "Ledelsen Oslo"],
      ["Oslo", "LedelsenOslo"],
    ]) {
      expect(
        docsAccessFromTeams(names.map((name) => team(randomId(), name)))
      ).toBeNull();
    }
  });

  it("no longer accepts clean expanded names on other ids", () => {
    expect(
      docsAccessFromTeams([
        team("c1", "National"),
        team("d1", "Operations Unit"),
      ])
    ).toBeNull();
    expect(
      docsAccessFromTeams([team("c1", "Oslo"), team("d1", "Ledelsen Oslo")])
    ).toBeNull();
  });

  it("does not trust a real id on one side and a copied name on the other", () => {
    expect(
      docsAccessFromTeams([
        team("sg-app-campus-national", "National"),
        team(randomId(), "SG-App-Dept-OperationsUnit"),
      ])
    ).toBeNull();
  });

  it("matches ids exactly, case and all", () => {
    expect(
      docsAccessFromTeams([
        team("SG-App-Campus-National"),
        team("SG-App-Dept-OperationsUnit"),
      ])
    ).toBeNull();
    expect(
      docsAccessFromTeams([
        team("sg-app-campus-national-x"),
        team("sg-app-dept-operationsunit"),
      ])
    ).toBeNull();
  });

  it("grants docs-handover by team id", () => {
    expect(docsAccessFromTeams([team(DOCS_HANDOVER_TEAM_ID, "Docs")])).toBe(
      "docs-handover"
    );
  });

  it("does not grant handover by name alone", () => {
    expect(docsAccessFromTeams([team(randomId(), "docs-handover")])).toBeNull();
  });

  it("prefers globaladmin over campusadmin over handover", () => {
    const handover = team(DOCS_HANDOVER_TEAM_ID);
    expect(
      docsAccessFromTeams([
        handover,
        team("sg-app-campus-oslo"),
        team("sg-app-dept-ledelsenoslo"),
      ])
    ).toBe("campusadmin");
    expect(
      docsAccessFromTeams([
        handover,
        team("sg-app-campus-oslo"),
        team("sg-app-dept-ledelsenoslo"),
        team("sg-app-campus-national"),
        team("sg-app-dept-operationsunit"),
      ])
    ).toBe("globaladmin");
  });

  it("returns null with no teams", () => {
    expect(docsAccessFromTeams([])).toBeNull();
  });
});

describe("trusted team ids follow the M365 sync's id rule", () => {
  const file = "apps/admin/src/lib/m365-sync.ts";
  const src = readFileSync(join(import.meta.dir, "../../../..", file), "utf8");
  const hint = `${file} changed how it builds team ids. Docs trusts exact ids built by that rule, listed in apps/docs/lib/auth/access.ts. Update the ids there to match the new rule (and the owner list in apps/docs/CLAUDE.md), then update this test.`;

  /** The rule as it stands: the Microsoft group display name, lowercased. */
  const syncedId = (displayName: string) => displayName.toLowerCase();

  it("still lowercases the group display name and nothing else", () => {
    const match = SANITIZE_TEAM_ID.exec(src);
    expect(match !== null && match[1] === match[2], hint).toBe(true);
  });

  it("still uses that rule for the team id it creates", () => {
    for (const needle of [
      "const teamId = sanitizeTeamId(azureGroup.name);",
      "await teams.create(teamId, teamName);",
    ]) {
      expect(src.includes(needle), `${hint} Missing: ${needle}`).toBe(true);
    }
  });

  it("still syncs only SG-App-Campus- and SG-App-Dept- groups", () => {
    const needle =
      'name.startsWith("SG-App-Campus-") || name.startsWith("SG-App-Dept-")';
    expect(src.includes(needle), `${hint} Missing: ${needle}`).toBe(true);
  });

  it("gives the global admin ids for the National and OperationsUnit groups", () => {
    const ids: Record<string, string> = GLOBAL_ADMIN_TEAM_IDS;
    expect(ids).toEqual({
      campus: syncedId("SG-App-Campus-National"),
      department: syncedId("SG-App-Dept-OperationsUnit"),
    });
  });

  it("gives one campus admin pair for every city, from its two groups", () => {
    const pairs: { campus: string; department: string }[] =
      CAMPUS_ADMIN_TEAM_IDS.map((pair) => ({ ...pair }));
    expect(pairs).toEqual(
      CAMPUS_CITY_NAMES.map((city) => ({
        campus: syncedId(`SG-App-Campus-${city}`),
        department: syncedId(`SG-App-Dept-Ledelsen${city}`),
      }))
    );
  });
});
