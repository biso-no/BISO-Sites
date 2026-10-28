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

describe("drift against admin role derivation", () => {
  const root = join(import.meta.dir, "../../../..");
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const hint =
    "Admin role derivation changed. Update apps/docs/lib/auth/access.ts to mirror it, then update this test.";

  const expectations: [string, string[]][] = [
    [
      "apps/admin/src/lib/authorization-team-memberships.ts",
      [
        '"SG-App-Campus-"',
        '"SG-App-Dept-"',
        '"sg-app-dept-"',
        "CAMPUS_NAME_TO_ID[team.name] !== undefined",
      ],
    ],
    [
      "packages/shared/utils/team-roles.ts",
      [
        '"National"',
        '"Operations Unit"',
        '"OperationsUnit"',
        "Ledelsen ",
        "Ledelsen",
        '"Oslo"',
        '"Bergen"',
        '"Stavanger"',
        '"Trondheim"',
        "([a-z])([A-Z])",
      ],
    ],
    [
      "apps/admin/src/lib/roles.ts",
      [
        'GLOBAL_ADMIN: "globaladmin"',
        'CAMPUS_ADMIN: "campusadmin"',
        "SG-App-Campus-National + SG-App-Dept-OperationsUnit",
        "SG-App-Campus-{City} + SG-App-Dept-Ledelsen{City}",
      ],
    ],
  ];

  for (const [file, needles] of expectations) {
    it(`still contains the mirrored rules in ${file}`, () => {
      const src = read(file);
      for (const needle of needles) {
        if (!src.includes(needle)) {
          throw new Error(`${hint} Missing in ${file}: ${needle}`);
        }
      }
      expect(true).toBe(true);
    });
  }
});
