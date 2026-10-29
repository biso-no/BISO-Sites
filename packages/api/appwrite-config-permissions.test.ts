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
  buckets: Array<{ $id: string; $permissions: string[] }>;
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

describe("team grants in table and bucket permissions", () => {
  const TEAM_GRANT = /team:([^"\\)/]+)/g;
  // Exactly the team ids that appear in a table or bucket permission today.
  const ALLOWED_TEAM_IDS = new Set([
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

  test("every team id in a table or bucket permission is on the allow-list", () => {
    const config = loadAppwriteConfig();
    for (const resource of [...config.tables, ...config.buckets]) {
      for (const teamId of teamIdsGranted(resource)) {
        expect(ALLOWED_TEAM_IDS.has(teamId), `${resource.$id}: ${teamId}`).toBe(
          true
        );
      }
    }
  });

  test("the allow-list holds no team id that nothing grants to", () => {
    const config = loadAppwriteConfig();
    const granted = new Set(
      [...config.tables, ...config.buckets].flatMap(teamIdsGranted)
    );
    expect([...ALLOWED_TEAM_IDS].sort()).toEqual([...granted].sort());
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

describe("content tables are readable only through row permissions", () => {
  const CONTENT_TABLES = [
    "campus_benefits",
    "pages",
    "page_translations",
    "events",
    "content_translations",
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

describe("Microsoft team sync records", () => {
  interface SyncTable {
    $id: string;
    $permissions: string[];
    columns: {
      array: boolean;
      key: string;
      required: boolean;
      size?: number;
      type: string;
    }[];
    databaseId: string;
    enabled: boolean;
    rowSecurity: boolean;
  }

  function findSyncTable(): SyncTable | undefined {
    const config = JSON.parse(
      readFileSync(join(import.meta.dirname, "appwrite.config.json"), "utf8")
    ) as { tables: SyncTable[] };
    return config.tables.find(
      (candidate) =>
        candidate.databaseId === "app" && candidate.$id === "m365_team_sync"
    );
  }

  test("m365_team_sync is service-only with row security", () => {
    const table = findSyncTable();

    expect(table).toBeDefined();
    expect(table?.enabled).toBe(true);
    expect(table?.rowSecurity).toBe(true);
    expect(table?.$permissions).toEqual([]);
  });

  test("m365_team_sync holds the team ids and the sync time", () => {
    const columns = findSyncTable()?.columns.map(
      ({ array, key, required, size, type }) => ({
        array,
        key,
        required,
        size,
        type,
      })
    );

    expect(columns).toEqual([
      {
        array: true,
        key: "team_ids",
        required: false,
        size: 128,
        type: "string",
      },
      {
        array: false,
        key: "synced_at",
        required: false,
        size: undefined,
        type: "datetime",
      },
    ]);
  });
});

describe("page drafts", () => {
  interface DraftColumn {
    array: boolean;
    elements?: string[];
    format?: string;
    key: string;
    required: boolean;
    size?: number;
    type: string;
  }

  interface DraftTable {
    $id: string;
    $permissions: string[];
    columns: DraftColumn[];
    databaseId: string;
    enabled: boolean;
    indexes: { columns: string[]; key: string; type: string }[];
    rowSecurity: boolean;
  }

  function findDraftTable(): DraftTable | undefined {
    const config = JSON.parse(
      readFileSync(join(import.meta.dirname, "appwrite.config.json"), "utf8")
    ) as { tables: DraftTable[] };
    return config.tables.find(
      (candidate) =>
        candidate.databaseId === "app" && candidate.$id === "page_drafts"
    );
  }

  test("page_drafts is service-only with row security", () => {
    const table = findDraftTable();

    expect(table).toBeDefined();
    expect(table?.enabled).toBe(true);
    expect(table?.rowSecurity).toBe(true);
    expect(table?.$permissions).toEqual([]);
  });

  test("page_drafts holds a translation's draft document, title and description", () => {
    const columns = findDraftTable()?.columns.map(
      ({ array, elements, format, key, required, size, type }) => ({
        array,
        elements,
        format,
        key,
        required,
        size,
        type,
      })
    );

    expect(columns).toEqual([
      {
        array: false,
        elements: undefined,
        format: undefined,
        key: "page_id",
        required: true,
        size: 50,
        type: "string",
      },
      {
        array: false,
        elements: ["no", "en"],
        format: "enum",
        key: "locale",
        required: true,
        size: undefined,
        type: "string",
      },
      {
        array: false,
        elements: undefined,
        format: undefined,
        key: "draft_doc",
        required: false,
        size: undefined,
        type: "mediumtext",
      },
      {
        array: false,
        elements: undefined,
        format: undefined,
        key: "title",
        required: false,
        size: 200,
        type: "string",
      },
      {
        array: false,
        elements: undefined,
        format: undefined,
        key: "description",
        required: false,
        size: 4000,
        type: "string",
      },
    ]);
  });

  test("page_drafts is indexed by page", () => {
    expect(
      findDraftTable()?.indexes.map(({ columns, key, type }) => ({
        columns,
        key,
        type,
      }))
    ).toEqual([{ columns: ["page_id"], key: "page_drafts_page", type: "key" }]);
  });
});
