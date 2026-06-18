import { describe, expect, test } from "bun:test";
import { CAMPUS_CITY_NAMES } from "@repo/shared/utils/team-roles";
import { checkRequiredTeams, REQUIRED_TEAMS } from "./team-health";

const ALL_REQUIRED_IDS = REQUIRED_TEAMS.map((team) => team.id);

describe("REQUIRED_TEAMS registry", () => {
  test("includes the canonical operational teams", () => {
    expect(ALL_REQUIRED_IDS).toEqual(
      expect.arrayContaining([
        "biso-members",
        "sg-app-campus-national",
        "sg-app-dept-operationsunit",
        "sg-app-dept-hr",
      ])
    );
  });

  test("includes a campus and a leadership team for every campus city", () => {
    for (const city of CAMPUS_CITY_NAMES) {
      const lower = city.toLowerCase();
      expect(ALL_REQUIRED_IDS).toContain(`sg-app-campus-${lower}`);
      expect(ALL_REQUIRED_IDS).toContain(`sg-app-dept-ledelsen${lower}`);
    }
  });

  test("every entry has a label, purpose, and an actionable fix", () => {
    for (const team of REQUIRED_TEAMS) {
      expect(team.label.length).toBeGreaterThan(0);
      expect(team.purpose.length).toBeGreaterThan(0);
      expect(team.fix.length).toBeGreaterThan(0);
      expect(["core", "campus", "leadership"]).toContain(team.category);
    }
  });

  test("team ids are unique and lowercased", () => {
    const unique = new Set(ALL_REQUIRED_IDS);
    expect(unique.size).toBe(ALL_REQUIRED_IDS.length);
    for (const id of ALL_REQUIRED_IDS) {
      expect(id).toBe(id.toLowerCase());
    }
  });
});

describe("checkRequiredTeams", () => {
  test("reports ok when every required team exists", () => {
    const report = checkRequiredTeams(ALL_REQUIRED_IDS);

    expect(report.ok).toBe(true);
    expect(report.missingCount).toBe(0);
    expect(report.missing).toHaveLength(0);
    expect(report.presentCount).toBe(REQUIRED_TEAMS.length);
    expect(report.total).toBe(REQUIRED_TEAMS.length);
    expect(report.entries.every((entry) => entry.present)).toBe(true);
  });

  test("flags a missing core team and keeps its fix guidance", () => {
    const withoutMembers = ALL_REQUIRED_IDS.filter(
      (id) => id !== "biso-members"
    );

    const report = checkRequiredTeams(withoutMembers);

    expect(report.ok).toBe(false);
    expect(report.missingCount).toBe(1);
    const missing = report.missing[0];
    expect(missing?.id).toBe("biso-members");
    expect(missing?.present).toBe(false);
    expect(missing?.category).toBe("core");
    expect(missing?.fix.length).toBeGreaterThan(0);
  });

  test("flags a missing campus team under the campus category", () => {
    const withoutOsloCampus = ALL_REQUIRED_IDS.filter(
      (id) => id !== "sg-app-campus-oslo"
    );

    const report = checkRequiredTeams(withoutOsloCampus);

    expect(report.ok).toBe(false);
    const missing = report.missing.find((e) => e.id === "sg-app-campus-oslo");
    expect(missing?.category).toBe("campus");
  });

  test("matches team ids case-insensitively and tolerates whitespace", () => {
    const messy = ALL_REQUIRED_IDS.map((id) => `  ${id.toUpperCase()}  `);

    const report = checkRequiredTeams(messy);

    expect(report.ok).toBe(true);
    expect(report.missingCount).toBe(0);
  });

  test("ignores unrelated teams that are not part of the registry", () => {
    const report = checkRequiredTeams([
      ...ALL_REQUIRED_IDS,
      "sg-app-dept-marketing",
      "some-other-team",
    ]);

    expect(report.ok).toBe(true);
    expect(report.total).toBe(REQUIRED_TEAMS.length);
  });

  test("reports every team missing when none exist", () => {
    const report = checkRequiredTeams([]);

    expect(report.ok).toBe(false);
    expect(report.missingCount).toBe(REQUIRED_TEAMS.length);
    expect(report.presentCount).toBe(0);
  });
});
