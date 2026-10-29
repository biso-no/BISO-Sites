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

describe("content tables are readable only through row permissions", () => {
  const CONTENT_TABLES = [
    "campus_benefits",
    "pages",
    "page_translations",
    "events",
  ] as const;

  function findContentTable(tableId: string) {
    return loadAppwriteConfig().tables.find(
      (candidate) => candidate.databaseId === "app" && candidate.$id === tableId
    );
  }

  test("row security is on and no table-level read grant remains", () => {
    for (const tableId of CONTENT_TABLES) {
      const table = findContentTable(tableId);

      expect(table, tableId).toBeDefined();
      expect(table?.rowSecurity, tableId).toBe(true);
      const readGrants = (table?.$permissions ?? []).filter((permission) =>
        permission.startsWith("read(")
      );
      expect(readGrants, tableId).toEqual([]);
    }
  });

  test("campus_benefits has no table-level permissions", () => {
    expect(findContentTable("campus_benefits")?.$permissions).toEqual([]);
  });
});
