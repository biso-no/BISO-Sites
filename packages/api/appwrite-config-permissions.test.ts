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

// ---------------------------------------------------------------------------
// Repo-wide permission invariants.
//
// Appwrite ORs table-level and row-level permissions: a row ACL cannot take
// away what the table already granted. The app builds read-only row ACLs and
// routes every write through the admin client behind a role check, so a
// table-level write grant held by a broad role silently defeats that model.
//
// `users` is the dangerous role here, not just `any`: the web app provisions an
// anonymous Appwrite session for ordinary visitors, and anonymous sessions
// carry the `users` role.
// ---------------------------------------------------------------------------

const WRITE_ACTIONS = ["create", "update", "delete", "write"] as const;
const BROAD_ROLES = ["any", "users"] as const;

/**
 * Tables allowed to grant a write action to a broad role, with the reason.
 * Empty by design — add an entry only with a written justification.
 */
const BROAD_WRITE_ALLOWLIST: Record<string, readonly string[]> = {};

describe("appwrite table permission invariants", () => {
  test("no table grants a write action to `any` or `users`", () => {
    const config = loadAppwriteConfig();
    const offenders: string[] = [];

    for (const table of config.tables) {
      const allowed = BROAD_WRITE_ALLOWLIST[table.$id] ?? [];
      for (const permission of table.$permissions) {
        const isBroadWrite =
          WRITE_ACTIONS.some((action) => permission.startsWith(`${action}(`)) &&
          BROAD_ROLES.some((role) => permission.includes(`"${role}"`));

        if (isBroadWrite && !allowed.includes(permission)) {
          offenders.push(`${table.$id}: ${permission}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Campus-management grants are maintained by hand, one team per campus, which
// is how Stavanger ended up missing from all seven content tables while the
// other three campuses were present. Assert the set is all-or-nothing so a new
// campus cannot be half-provisioned again.
// ---------------------------------------------------------------------------

const CAMPUS_LEADERSHIP_TEAMS = [
  "sg-app-dept-ledelsenoslo",
  "sg-app-dept-ledelsenbergen",
  "sg-app-dept-ledelsentrondheim",
  "sg-app-dept-ledelsenstavanger",
] as const;

describe("campus management grants", () => {
  test("a table granting one campus-management team grants all of them", () => {
    const config = loadAppwriteConfig();
    const incomplete: string[] = [];

    for (const table of config.tables) {
      const joined = table.$permissions.join(" ");
      const present = CAMPUS_LEADERSHIP_TEAMS.filter((team) =>
        joined.includes(team)
      );

      if (
        present.length > 0 &&
        present.length !== CAMPUS_LEADERSHIP_TEAMS.length
      ) {
        const missing = CAMPUS_LEADERSHIP_TEAMS.filter(
          (team) => !joined.includes(team)
        );
        incomplete.push(`${table.$id} missing: ${missing.join(", ")}`);
      }
    }

    expect(incomplete).toEqual([]);
  });
});
