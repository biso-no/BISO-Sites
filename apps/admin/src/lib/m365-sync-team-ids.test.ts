import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAMPUS_CITY_NAMES,
  CAMPUS_TEAM_IDS,
  HR_TEAM_IDS,
  LEDELSEN_TEAM_IDS,
  OPERATIONS_UNIT_TEAM_ID,
} from "@repo/shared/utils/team-roles";

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
    expect(hrIds).toEqual([
      syncedId("SG-App-Dept-HR"),
      syncedId("SG-App-Dept-HRUnit"),
    ]);
  });

  it("gives every city's Ledelsen team its synced id", () => {
    for (const city of CAMPUS_CITY_NAMES) {
      expect(LEDELSEN_TEAM_IDS[city]).toBe(
        syncedId(`SG-App-Dept-Ledelsen${city}`)
      );
    }
  });
});
