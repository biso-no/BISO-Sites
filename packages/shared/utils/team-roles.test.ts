import { describe, expect, it } from "vitest";
import {
  CAMPUS_CITY_NAMES,
  CAMPUS_TEAM_IDS,
  expandDepartmentName,
  keepSyncedTeams,
  LEDELSEN_TEAM_IDS,
  M365_TEAM_SYNC_TABLE_ID,
  rolesFromTeams,
  SYNCED_GROUP_PREFIXES,
  syncedTeamIdForGroup,
} from "./team-roles";

describe("expandDepartmentName", () => {
  it("expands camelCase to spaced words", () => {
    expect(expandDepartmentName("OperationsUnit")).toBe("Operations Unit");
    expect(expandDepartmentName("LedelsenOslo")).toBe("Ledelsen Oslo");
  });

  it("leaves already-expanded names alone", () => {
    expect(expandDepartmentName("Operations Unit")).toBe("Operations Unit");
  });
});

describe("rolesFromTeams", () => {
  const team = ($id: string, name = "Any name") => ({ $id, name });
  const randomId = () => `user-${crypto.randomUUID().slice(0, 8)}`;

  it("grants global admin for the National and Operations Unit ids", () => {
    const roles = rolesFromTeams([
      team("sg-app-campus-national", "National"),
      team("sg-app-dept-operationsunit", "Operations Unit"),
    ]);
    expect(roles.isGlobalAdmin).toBe(true);
    expect(roles.campusNames).toEqual(["National"]);
    expect(roles.departmentNames).toEqual(["Operations Unit"]);
  });

  it("manages a city with its campus id and its Ledelsen id", () => {
    for (const city of CAMPUS_CITY_NAMES) {
      const roles = rolesFromTeams([
        team(CAMPUS_TEAM_IDS[city]),
        team(LEDELSEN_TEAM_IDS[city]),
      ]);
      expect(roles.managedCampuses).toEqual([city]);
    }
    expect(
      rolesFromTeams([
        team("sg-app-campus-oslo"),
        team("sg-app-dept-ledelsenbergen"),
      ]).managedCampuses
    ).toEqual([]);
  });

  it("ignores user-created teams that copy names", () => {
    const nameSets = [
      ["SG-App-Campus-National", "SG-App-Dept-OperationsUnit"],
      ["National", "Operations Unit"],
      ["Oslo", "Ledelsen Oslo"],
      ["HR"],
    ];
    for (const names of nameSets) {
      const roles = rolesFromTeams(names.map((n) => team(randomId(), n)));
      expect(roles.isGlobalAdmin).toBe(false);
      expect(roles.managedCampuses).toEqual([]);
      expect(roles.campusNames).toEqual([]);
      expect(roles.departmentNames).toEqual([]);
      expect(roles.departmentTeamIds).toEqual([]);
      expect(roles.isHr).toBe(false);
    }
  });

  it("matches ids exactly", () => {
    const roles = rolesFromTeams([
      team("SG-App-Campus-National"),
      team("sg-app-campus-national-x"),
      team("sg-app-dept-operationsunit "),
    ]);
    expect(roles.campusNames).toEqual([]);
    expect(roles.campusTeamIds).toEqual([]);
    expect(roles.isGlobalAdmin).toBe(false);
  });

  it("keeps a department name only when it matches its id", () => {
    expect(
      rolesFromTeams([team("sg-app-dept-marketing", "Marketing")])
        .departmentNames
    ).toEqual(["Marketing"]);
    expect(
      rolesFromTeams([team("sg-app-dept-ledelsenoslo", "Ledelsen Oslo")])
        .departmentNames
    ).toEqual(["Ledelsen Oslo"]);
    expect(
      rolesFromTeams([
        team("sg-app-dept-operationsunit", "SG-App-Dept-OperationsUnit"),
      ]).departmentNames
    ).toEqual(["Operations Unit"]);
    const mismatched = rolesFromTeams([
      team("sg-app-dept-marketing", "Operations Unit"),
    ]);
    expect(mismatched.departmentNames).toEqual([]);
    expect(mismatched.departmentTeamIds).toEqual(["sg-app-dept-marketing"]);
  });

  it("a renamed synced team keeps its role", () => {
    const roles = rolesFromTeams([
      team("sg-app-campus-national", "Renamed"),
      team("sg-app-dept-operationsunit", "Renamed too"),
    ]);
    expect(roles.isGlobalAdmin).toBe(true);
    expect(roles.campusNames).toEqual(["National"]);
    expect(roles.departmentNames).toEqual([]);
  });

  it("HR comes from the HR ids", () => {
    const hr = rolesFromTeams([team("sg-app-dept-hr", "HR")]);
    expect(hr.isHr).toBe(true);
    expect(hr.isNationalHr).toBe(false);
    expect(
      rolesFromTeams([
        team("sg-app-dept-hr", "HR"),
        team("sg-app-campus-national"),
      ]).isNationalHr
    ).toBe(true);
    expect(rolesFromTeams([team("sg-app-dept-hrunit", "HRUnit")]).isHr).toBe(
      false
    );
    expect(rolesFromTeams([team(randomId(), "HR")]).isHr).toBe(false);
  });

  it("returns empty roles for no teams", () => {
    expect(rolesFromTeams([])).toEqual({
      campusNames: [],
      campusTeamIds: [],
      departmentNames: [],
      departmentTeamIds: [],
      isGlobalAdmin: false,
      isHr: false,
      isNationalHr: false,
      managedCampuses: [],
    });
  });
});

describe("syncedTeamIdForGroup", () => {
  it("lowercases campus and department group names", () => {
    expect(syncedTeamIdForGroup("SG-App-Dept-OperationsUnit")).toBe(
      "sg-app-dept-operationsunit"
    );
    expect(syncedTeamIdForGroup("SG-App-Campus-Oslo")).toBe(
      "sg-app-campus-oslo"
    );
  });

  it("returns null for groups the sync doesn't turn into teams", () => {
    expect(syncedTeamIdForGroup("SG-App-Role-Admin")).toBeNull();
    expect(syncedTeamIdForGroup("Marketing")).toBeNull();
    expect(syncedTeamIdForGroup("sg-app-dept-marketing")).toBeNull();
    expect(syncedTeamIdForGroup("")).toBeNull();
  });

  it("covers exactly the campus and department prefixes", () => {
    expect([...SYNCED_GROUP_PREFIXES]).toEqual([
      "SG-App-Campus-",
      "SG-App-Dept-",
    ]);
  });
});

describe("keepSyncedTeams", () => {
  const team = ($id: string, name = "Any name") => ({ $id, name });
  const marketing = team("sg-app-dept-oslmarketing", "OSL Marketing");
  const members = team("biso-members", "BISO Members");
  const handover = team("docs-handover", "Docs handover");

  it("drops an sg-app team whose id isn't in the record", () => {
    expect(
      keepSyncedTeams([marketing, members, handover], new Set<string>())
    ).toEqual([members, handover]);
  });

  it("keeps an sg-app team whose id is in the record", () => {
    expect(
      keepSyncedTeams(
        [marketing, members, handover],
        new Set(["sg-app-dept-oslmarketing"])
      )
    ).toEqual([marketing, members, handover]);
  });

  it("drops every sg-app team when there is no record", () => {
    const kept = keepSyncedTeams(
      [
        team("sg-app-campus-national"),
        team("sg-app-dept-operationsunit"),
        team("sg-app-role-admin"),
      ],
      new Set()
    );
    expect(kept).toEqual([]);
    expect(rolesFromTeams(kept).isGlobalAdmin).toBe(false);
  });

  it("matches ids exactly", () => {
    expect(
      keepSyncedTeams(
        [team("sg-app-campus-oslo")],
        new Set(["SG-App-Campus-Oslo", "sg-app-campus-oslo "])
      )
    ).toEqual([]);
  });

  it("names the service-only record table", () => {
    expect(M365_TEAM_SYNC_TABLE_ID).toBe("m365_team_sync");
  });
});
