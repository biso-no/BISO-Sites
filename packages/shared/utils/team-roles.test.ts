import { describe, expect, it } from "vitest";
import {
  CAMPUS_CITY_NAMES,
  CAMPUS_TEAM_IDS,
  expandDepartmentName,
  LEDELSEN_TEAM_IDS,
  rolesFromTeams,
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
      true
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
