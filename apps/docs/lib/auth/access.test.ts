import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOCS_HANDOVER_TEAM_ID, docsAccessFromTeams } from "./access";

const team = (name: string, id = name.toLowerCase()) => ({ $id: id, name });

describe("docsAccessFromTeams", () => {
  it("grants globaladmin for National + OperationsUnit", () => {
    expect(
      docsAccessFromTeams([
        team("SG-App-Campus-National", "c1"),
        team("SG-App-Dept-OperationsUnit", "d1"),
      ])
    ).toBe("globaladmin");
  });

  it("accepts clean expanded names", () => {
    expect(
      docsAccessFromTeams([
        team("National", "c1"),
        team("Operations Unit", "sg-app-dept-operationsunit"),
      ])
    ).toBe("globaladmin");
  });

  it("grants campusadmin for campus + matching Ledelsen", () => {
    expect(
      docsAccessFromTeams([
        team("SG-App-Campus-Oslo", "c1"),
        team("SG-App-Dept-LedelsenOslo", "d1"),
      ])
    ).toBe("campusadmin");
  });

  it("denies a campus with another city's Ledelsen", () => {
    expect(
      docsAccessFromTeams([
        team("SG-App-Campus-Oslo", "c1"),
        team("SG-App-Dept-LedelsenBergen", "d1"),
      ])
    ).toBeNull();
  });

  it("denies a department-only HR member", () => {
    expect(docsAccessFromTeams([team("SG-App-Dept-HR", "d1")])).toBeNull();
  });

  it("denies National + HR (not operations)", () => {
    expect(
      docsAccessFromTeams([
        team("SG-App-Campus-National", "c1"),
        team("SG-App-Dept-HR", "d1"),
      ])
    ).toBeNull();
  });

  it("grants docs-handover by team id", () => {
    expect(
      docsAccessFromTeams([{ $id: DOCS_HANDOVER_TEAM_ID, name: "Docs" }])
    ).toBe("docs-handover");
  });

  it("prefers globaladmin over campusadmin over handover", () => {
    const handover = { $id: DOCS_HANDOVER_TEAM_ID, name: "Docs" };
    expect(
      docsAccessFromTeams([
        handover,
        team("SG-App-Campus-Oslo", "c1"),
        team("SG-App-Dept-LedelsenOslo", "d1"),
      ])
    ).toBe("campusadmin");
    expect(
      docsAccessFromTeams([
        handover,
        team("SG-App-Campus-National", "c2"),
        team("SG-App-Dept-OperationsUnit", "d2"),
      ])
    ).toBe("globaladmin");
  });

  it("does not grant handover by name alone", () => {
    expect(
      docsAccessFromTeams([{ $id: "other", name: "docs-handover" }])
    ).toBeNull();
  });

  it("grants campusadmin via the sg-app-dept id path", () => {
    expect(
      docsAccessFromTeams([
        team("Oslo", "c1"),
        { $id: "sg-app-dept-ledelsenoslo", name: "Ledelsen Oslo" },
      ])
    ).toBe("campusadmin");
  });

  it("returns null with no teams", () => {
    expect(docsAccessFromTeams([])).toBeNull();
  });

  it("is case-sensitive like the admin", () => {
    expect(
      docsAccessFromTeams([
        team("sg-app-campus-national", "c1"),
        team("SG-App-Dept-OperationsUnit", "d1"),
      ])
    ).toBeNull();
  });
});

describe("drift against the admin team parser", () => {
  const file = "apps/admin/src/lib/authorization-team-memberships.ts";
  const src = readFileSync(join(import.meta.dir, "../../../..", file), "utf8");
  const hint = `${file} changed. Update the team parser in apps/docs/lib/auth/access.ts to mirror it, then update this test.`;

  const needles = [
    '"SG-App-Campus-"',
    '"SG-App-Dept-"',
    '$id.startsWith("sg-app-dept-")',
    "CAMPUS_NAME_TO_ID[team.name] !== undefined",
  ];

  for (const needle of needles) {
    it(`still contains ${needle}`, () => {
      expect(src.includes(needle), `${hint} Missing: ${needle}`).toBe(true);
    });
  }
});
