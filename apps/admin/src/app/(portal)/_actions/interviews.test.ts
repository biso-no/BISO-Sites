import { beforeEach, describe, expect, mock, test } from "bun:test";
import { JobInterviewParticipantsRole } from "@repo/api/types/appwrite";
import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";

const db = {
  createRow: mock(),
  getTable: mock(),
  getRow: mock(),
  listRows: mock(),
  updateTable: mock(),
  updateRow: mock(),
};

const ctx = {
  email: "hr@example.com",
  userId: "user-1",
};

function getMockDb(): unknown {
  return (globalThis as { __appwriteMockDb?: unknown }).__appwriteMockDb ?? db;
}

(globalThis as { __appwriteMockDb?: unknown }).__appwriteMockDb = db;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: getMockDb() })),
  createSessionClient: mock(async () => ({ db: getMockDb() })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ctx),
}));

mock.module("@/lib/recruitment", () => ({
  assertInterviewWriteAccess: mock(() => undefined),
  assertScorecardWriteAccess: mock(() => undefined),
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map(),
    campusNamesById: new Map(),
    departmentIdsByName: new Map(),
    departmentNamesById: new Map(),
  })),
  toRecruitmentAdminScope: mock(() => ({
    canManageAnyCampus: false,
    isCampusAdmin: true,
    isGlobalAdmin: false,
    managedCampusNames: ["Oslo"],
    managedDepartmentNames: [],
    userId: "user-1",
  })),
}));

mock.module("@/lib/recruitment-booking", () => ({
  issueBookingToken: mock(() => ({
    hash: "hashed-booking-token",
    token: "booking-token",
  })),
}));

mock.module("@/lib/recruitment-scheduling", () => ({
  proposeSlotsForPanel: mock(async () => ({ available: true, slots: [] })),
  scheduleInterviewOnGraph: mock(async () => ({})),
}));

mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { createBookingToken, createInterview, submitScorecard } = await import(
  "./interviews"
);

const staffPermissions = buildRecruitmentStaffRowPermissions();

const applicationWithJob = {
  $id: "application-1",
  applicant_email: "candidate@example.com",
  applicant_name: "Candidate Person",
  job: {
    $id: "job-1",
    campus_id: "campus-oslo",
    department_id: "dept-hr",
  },
  job_id: "job-1",
};

function createdRowCall(tableId: string) {
  return db.createRow.mock.calls.find((call) => call[1] === tableId);
}

describe("recruitment interview actions", () => {
  beforeEach(() => {
    (globalThis as { __appwriteMockDb?: unknown }).__appwriteMockDb = db;
    db.createRow.mockReset();
    db.getTable.mockReset();
    db.getRow.mockReset();
    db.listRows.mockReset();
    db.updateTable.mockReset();
    db.updateRow.mockReset();

    db.createRow.mockImplementation(
      async (
        _databaseId: string,
        tableId: string,
        rowId: string,
        data: Record<string, unknown>,
        permissions?: string[]
      ) => ({
        $id: rowId,
        $permissions: permissions,
        ...data,
        tableId,
      })
    );
    db.updateRow.mockImplementation(
      async (
        _databaseId: string,
        tableId: string,
        rowId: string,
        data: Record<string, unknown>,
        permissions?: string[]
      ) => ({
        $id: rowId,
        $permissions: permissions,
        ...data,
        tableId,
      })
    );
  });

  test("stamps created interviews and participants with recruitment staff permissions", async () => {
    db.getRow.mockResolvedValue(applicationWithJob);

    const result = await createInterview({
      application_id: "application-1",
      auto_create_teams_meeting: false,
      ends_at: "2026-07-01T11:00:00.000Z",
      location: null,
      meeting_url: null,
      notes: null,
      participants: [
        {
          display_name: "Panel Member",
          email: "panel@example.com",
          is_lead: true,
          role: "interviewer",
          user_id: "panel-1",
        },
      ],
      round: 1,
      starts_at: "2026-07-01T10:00:00.000Z",
      timezone: "Europe/Oslo",
      title: "Interview",
    });

    expect(result.error).toBeUndefined();
    expect(createdRowCall("job_interviews")?.[4]).toEqual(staffPermissions);

    const participantCalls = db.createRow.mock.calls.filter(
      (call) => call[1] === "job_interview_participants"
    );
    expect(participantCalls).toHaveLength(2);
    for (const call of participantCalls) {
      expect(call[4]).toEqual(staffPermissions);
    }
  });

  test("stamps new scorecards with recruitment staff permissions", async () => {
    db.getRow.mockResolvedValue({
      $id: "interview-1",
      application_id: "application-1",
      participants: [
        {
          role: JobInterviewParticipantsRole.INTERVIEWER,
          user_id: "user-1",
        },
      ],
    });
    db.listRows.mockResolvedValue({ rows: [], total: 0 });

    const result = await submitScorecard({
      concerns: null,
      criteria: [],
      interview_id: "interview-1",
      overall_score: 4,
      private_notes: null,
      recommendation: "hire",
      strengths: "Clear communication.",
    });

    expect(result.error).toBeUndefined();
    expect(createdRowCall("job_interview_scorecards")?.[4]).toEqual(
      staffPermissions
    );
  });

  test("stamps issued booking tokens with recruitment staff permissions", async () => {
    db.getRow.mockResolvedValue(applicationWithJob);

    const result = await createBookingToken({
      application_id: "application-1",
      duration_minutes: 30,
      expires_in_days: 7,
      panel_user_ids: ["panel-1"],
      window_from: "2026-07-01T09:00:00.000Z",
      window_to: "2026-07-01T17:00:00.000Z",
    });

    expect(result.error).toBeUndefined();
    expect(createdRowCall("recruitment_booking_tokens")?.[4]).toEqual(
      staffPermissions
    );
  });
});
