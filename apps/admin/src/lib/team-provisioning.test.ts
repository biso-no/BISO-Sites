import { beforeEach, describe, expect, mock, test } from "bun:test";

const db = {
  createRow: mock(),
  getTable: mock(),
  getRow: mock(),
  listRows: mock(),
  updateTable: mock(),
  updateRow: mock(),
};

function getMockDb(): unknown {
  return (globalThis as { __appwriteMockDb?: unknown }).__appwriteMockDb ?? db;
}

(globalThis as { __appwriteMockDb?: unknown }).__appwriteMockDb = db;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: getMockDb() })),
  createSessionClient: mock(async () => ({ db: getMockDb() })),
}));

const { grantTeamRecruitmentAccess } = await import("./team-provisioning");

const RESTRICTED_RECRUITMENT_TABLES = [
  "job_applications",
  "job_application_answers",
  "candidate_profiles",
  "job_interviews",
  "job_interview_participants",
  "job_interview_scorecards",
  "recruitment_booking_tokens",
] as const;

const OPS_CREATE = ['create("team:sg-app-dept-operationsunit")'] as const;

describe("grantTeamRecruitmentAccess", () => {
  beforeEach(() => {
    (globalThis as { __appwriteMockDb?: unknown }).__appwriteMockDb = db;
    db.createRow.mockReset();
    db.getTable.mockReset();
    db.getRow.mockReset();
    db.listRows.mockReset();
    db.updateTable.mockReset();
    db.updateRow.mockReset();
    db.getTable.mockResolvedValue({ $permissions: [...OPS_CREATE] });
  });

  test("does nothing for non-HR department teams", async () => {
    await grantTeamRecruitmentAccess("sg-app-dept-marketing");

    expect(db.getTable).not.toHaveBeenCalled();
    expect(db.updateTable).not.toHaveBeenCalled();
  });

  test("grants HR create-only without adding read/write grants", async () => {
    await grantTeamRecruitmentAccess("sg-app-dept-hr");

    expect(db.getTable).toHaveBeenCalledTimes(
      RESTRICTED_RECRUITMENT_TABLES.length
    );
    expect(db.updateTable).toHaveBeenCalledTimes(
      RESTRICTED_RECRUITMENT_TABLES.length
    );

    for (const tableId of RESTRICTED_RECRUITMENT_TABLES) {
      expect(db.getTable).toHaveBeenCalledWith({
        databaseId: "app",
        tableId,
      });
    }

    for (const call of db.updateTable.mock.calls) {
      const update = call[0] as { permissions: string[] };
      expect(update.permissions).toContain(
        'create("team:sg-app-dept-operationsunit")'
      );
      expect(update.permissions).toContain('create("team:sg-app-dept-hr")');
      expect(update.permissions).not.toContain('create("team:admin")');
      expect(update.permissions).not.toContain('read("team:admin")');
      expect(update.permissions).not.toContain('read("team:sg-app-dept-hr")');
      expect(update.permissions).not.toContain('update("team:sg-app-dept-hr")');
      expect(update.permissions).not.toContain('delete("team:sg-app-dept-hr")');
    }
  });
});
