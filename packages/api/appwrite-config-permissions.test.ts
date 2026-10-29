import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const RESTRICTED_RECRUITMENT_TABLES = [
  "job_applications",
  "job_application_answers",
  "candidate_profiles",
  "job_interviews",
  "job_interview_participants",
  "job_interview_scorecards",
  "recruitment_booking_tokens",
] as const;

const EXPECTED_TABLE_PERMISSIONS = [
  'create("team:sg-app-dept-operationsunit")',
  'create("team:sg-app-dept-hr")',
] as const;

function loadAppwriteConfig(): {
  tables: Array<{
    $id: string;
    $permissions: string[];
    databaseId: string;
    rowSecurity: boolean;
  }>;
} {
  return JSON.parse(
    readFileSync(join(import.meta.dirname, "appwrite.config.json"), "utf8")
  );
}

describe("recruitment Appwrite table permissions", () => {
  test("Appwrite table grants do not depend on a literal admin team", () => {
    const config = loadAppwriteConfig();

    for (const table of config.tables) {
      expect(table.$permissions.join(" "), table.$id).not.toContain(
        "team:admin"
      );
    }
  });

  test("restricted recruitment tables are Operations Unit and HR create-only", () => {
    const config = loadAppwriteConfig();

    for (const tableId of RESTRICTED_RECRUITMENT_TABLES) {
      const table = config.tables.find(
        (candidate) =>
          candidate.databaseId === "app" && candidate.$id === tableId
      );

      expect(table, tableId).toBeDefined();
      expect(table?.$permissions, tableId).toEqual([
        ...EXPECTED_TABLE_PERMISSIONS,
      ]);
      expect(table?.$permissions, tableId).not.toContain('create("users")');
      expect(table?.$permissions, tableId).not.toContain(
        'create("team:admin")'
      );
      expect(table?.$permissions, tableId).not.toContain('read("team:admin")');
      expect(table?.$permissions, tableId).not.toContain(
        'update("team:admin")'
      );
      expect(table?.$permissions, tableId).not.toContain(
        'delete("team:admin")'
      );
      expect(table?.$permissions, tableId).not.toContain(
        'read("team:sg-app-dept-operationsunit")'
      );
      expect(table?.$permissions, tableId).not.toContain(
        'update("team:sg-app-dept-operationsunit")'
      );
      expect(table?.$permissions, tableId).not.toContain(
        'delete("team:sg-app-dept-operationsunit")'
      );
      expect(table?.$permissions, tableId).not.toContain(
        'read("team:sg-app-dept-hr")'
      );
      expect(table?.$permissions, tableId).not.toContain(
        'update("team:sg-app-dept-hr")'
      );
      expect(table?.$permissions, tableId).not.toContain(
        'delete("team:sg-app-dept-hr")'
      );
    }
  });

  test("recruitment booking tokens use row security", () => {
    const config = loadAppwriteConfig();
    const table = config.tables.find(
      (candidate) =>
        candidate.databaseId === "app" &&
        candidate.$id === "recruitment_booking_tokens"
    );

    expect(table?.rowSecurity).toBe(true);
  });
});

describe("profile table permissions", () => {
  test("signed-in users cannot create profile rows themselves", () => {
    const table = loadAppwriteConfig().tables.find(
      (candidate) => candidate.databaseId === "app" && candidate.$id === "user"
    );

    expect(table).toBeDefined();
    expect(table?.$permissions).not.toContain('create("users")');
  });
});

describe("app versions table", () => {
  test("app_versions is Operations Unit only, like payment_settings", () => {
    const config = loadAppwriteConfig();
    const table = config.tables.find((t) => t.$id === "app_versions");
    const payments = config.tables.find((t) => t.$id === "payment_settings");

    expect(table?.databaseId).toBe("app");
    expect(table?.rowSecurity).toBe(false);
    expect([...(table?.$permissions ?? [])].sort()).toEqual(
      [...(payments?.$permissions ?? [])].sort()
    );
    expect(table?.$permissions.join(" ")).not.toContain('read("any")');
  });
});

describe("team grants in table permissions", () => {
  const TEAM_GRANT = /team:([^"\\)/]+)/g;
  const ALLOWED_TEAM_IDS = new Set([
    "biso-members",
    "finance",
    "sg-app-campus-national",
    "sg-app-dept-hr",
    "sg-app-dept-ledelsenbergen",
    "sg-app-dept-ledelsenoslo",
    "sg-app-dept-ledelsenstavanger",
    "sg-app-dept-ledelsentrondheim",
    "sg-app-dept-operationsunit",
  ]);

  function teamIdsGranted(table: { $permissions: string[] }): string[] {
    return table.$permissions.flatMap((permission) =>
      [...permission.matchAll(TEAM_GRANT)].map((match) => match[1] as string)
    );
  }

  test("no table grants anything to team:alumni_admins", () => {
    for (const table of loadAppwriteConfig().tables) {
      expect(table.$permissions.join(" "), table.$id).not.toContain(
        "alumni_admins"
      );
    }
  });

  test("every team id in a table permission is on the allow-list", () => {
    for (const table of loadAppwriteConfig().tables) {
      for (const teamId of teamIdsGranted(table)) {
        expect(ALLOWED_TEAM_IDS.has(teamId), `${table.$id}: ${teamId}`).toBe(
          true
        );
      }
    }
  });

  test("feature_flags grants only Operations Unit write access", () => {
    const table = loadAppwriteConfig().tables.find(
      (candidate) => candidate.$id === "feature_flags"
    );

    expect(table).toBeDefined();
    expect(new Set(teamIdsGranted(table ?? { $permissions: [] }))).toEqual(
      new Set(["sg-app-dept-operationsunit"])
    );
  });
});
