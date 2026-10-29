import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAMPUS_CITY_NAMES,
  CAMPUS_TEAM_IDS,
  HR_TEAM_IDS,
  LEDELSEN_TEAM_IDS,
  OPERATIONS_UNIT_TEAM_ID,
  SYNCED_GROUP_PREFIXES,
  syncedTeamIdForGroup,
} from "@repo/shared/utils/team-roles";

/** A bare `name.startsWith("…")` test, as in `parseAzureGroups`. */
const GROUP_PREFIX_TEST = /(?<![.\w])name\.startsWith\("([^"]+)"\)/g;

/** `sanitizeTeamId` in m365-sync.ts: returns its argument, lowercased. */
const SANITIZE_TEAM_ID =
  /function sanitizeTeamId\((\w+): string\): string \{\s*return (\w+)\.toLowerCase\(\);\s*\}/;

describe("trusted team ids follow the M365 sync's id rule", () => {
  const src = readFileSync(join(import.meta.dir, "m365-sync.ts"), "utf8");
  const hint =
    "apps/admin/src/lib/m365-sync.ts changed how it builds team ids. Admin and the API trust exact ids built by that rule, listed in packages/shared/utils/team-roles.ts. Update the ids there to match the new rule, then update this test.";

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

  it("still reads the team name from the group's displayName", () => {
    const needle = 'const name = group.displayName || "";';
    expect(src.includes(needle), `${hint} Missing: ${needle}`).toBe(true);
  });

  it("still syncs only SG-App-Campus- and SG-App-Dept- groups", () => {
    const needle =
      'name.startsWith("SG-App-Campus-") || name.startsWith("SG-App-Dept-")';
    expect(src.includes(needle), `${hint} Missing: ${needle}`).toBe(true);
  });

  it("agrees with syncedTeamIdForGroup on which groups become teams", () => {
    const syncPrefixes = [...src.matchAll(GROUP_PREFIX_TEST)].map(
      (match) => match[1]
    );
    expect(syncPrefixes, hint).toEqual([...SYNCED_GROUP_PREFIXES]);
  });

  it("agrees with syncedTeamIdForGroup on the id of each group", () => {
    for (const group of [
      "SG-App-Campus-National",
      "SG-App-Campus-Oslo",
      "SG-App-Dept-OperationsUnit",
      "SG-App-Dept-HR",
      "SG-App-Dept-LedelsenTrondheim",
    ]) {
      expect(syncedTeamIdForGroup(group), hint).toBe(syncedId(group));
    }
    for (const group of ["SG-App-Role-Admin", "Everyone", "sg-app-dept-x"]) {
      expect(syncedTeamIdForGroup(group), hint).toBeNull();
    }
  });

  it("still records the team ids it computed for the user", () => {
    const recordHint =
      "Admin and the API keep an sg-app team only when its id is in the user's m365_team_sync record, which syncM365Permissions writes from expectedTeamIds.";
    for (const needle of [
      "teamsToSync.map((g) => sanitizeTeamId(g.name))",
      "team_ids: [...expectedTeamIds],",
    ]) {
      expect(src.includes(needle), `${recordHint} Missing: ${needle}`).toBe(
        true
      );
    }
  });

  it("gives every campus team its group's synced id", () => {
    expect(CAMPUS_TEAM_IDS).toEqual({
      National: syncedId("SG-App-Campus-National"),
      Oslo: syncedId("SG-App-Campus-Oslo"),
      Bergen: syncedId("SG-App-Campus-Bergen"),
      Stavanger: syncedId("SG-App-Campus-Stavanger"),
      Trondheim: syncedId("SG-App-Campus-Trondheim"),
    });
  });

  it("gives the Operations Unit and HR teams their synced ids", () => {
    expect(OPERATIONS_UNIT_TEAM_ID).toBe(
      syncedId("SG-App-Dept-OperationsUnit")
    );
    const hrIds: string[] = [...HR_TEAM_IDS];
    expect(hrIds).toEqual([syncedId("SG-App-Dept-HR")]);
  });

  it("gives every city's Ledelsen team its synced id", () => {
    for (const city of CAMPUS_CITY_NAMES) {
      expect(LEDELSEN_TEAM_IDS[city]).toBe(
        syncedId(`SG-App-Dept-Ledelsen${city}`)
      );
    }
  });
});
