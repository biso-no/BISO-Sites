import { createHash } from "node:crypto";
import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  process.env.RECRUITMENT_BOOKING_SECRET = "booking-secret";
  return {
    createRow: vi.fn(),
    decrementRowColumn: vi.fn(),
    getRow: vi.fn(),
    incrementRowColumn: vi.fn(),
    listRows: vi.fn(),
    updateRow: vi.fn(),
  };
});

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db })),
}));

import { confirmBookingSlot } from "./booking";

const staffPermissions = buildRecruitmentStaffRowPermissions();

function tokenHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

const tokenRow = {
  $id: "token-row-1",
  application_id: "application-1",
  consumed_at: null,
  created_by_user_id: "hr-user-1",
  duration_minutes: 30,
  expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
  panel_user_ids: JSON.stringify(["panel-1"]),
  token_hash: tokenHash("booking-token"),
  window_from: "2026-07-01T09:00:00.000Z",
  window_to: "2026-07-01T17:00:00.000Z",
};

function mockHappyPath({
  overlappingInterviews = [] as Array<{ $id: string }>,
} = {}) {
  db.listRows.mockImplementation((_databaseId: string, tableId: string) => {
    if (tableId === "recruitment_booking_tokens") {
      return Promise.resolve({ rows: [tokenRow], total: 1 });
    }
    if (tableId === "job_interviews") {
      return Promise.resolve({
        rows: overlappingInterviews,
        total: overlappingInterviews.length,
      });
    }
    return Promise.resolve({ rows: [], total: 0 });
  });
  db.getRow
    .mockResolvedValueOnce({
      $id: "application-1",
      applicant_email: "candidate@example.com",
      applicant_name: "Candidate Person",
      job_id: "job-1",
    })
    .mockResolvedValueOnce({
      $id: "job-1",
      campus: { name: "Oslo" },
      campus_id: "campus-oslo",
      department: { Name: "HR" },
      department_id: "dept-hr",
    });
}

describe("recruitment booking actions", () => {
  beforeEach(() => {
    (globalThis as { __appwriteMockDb?: unknown }).__appwriteMockDb = db;
    db.createRow.mockReset();
    db.decrementRowColumn.mockReset();
    db.getRow.mockReset();
    db.incrementRowColumn.mockReset();
    db.listRows.mockReset();
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
    db.updateRow.mockResolvedValue({});
    db.incrementRowColumn.mockResolvedValue({ claim_lock: 1 });
    db.decrementRowColumn.mockResolvedValue({ claim_lock: 0 });
  });

  it("stamps candidate-booked interviews with recruitment staff permissions", async () => {
    mockHappyPath();

    const result = await confirmBookingSlot(
      "booking-token",
      "2026-07-01T10:00:00.000Z",
      30
    );

    expect(result).toEqual({
      data: {
        interview_id: expect.any(String),
        starts_at: "2026-07-01T10:00:00.000Z",
      },
    });
    const interviewCall = db.createRow.mock.calls.find(
      (call: unknown[]) => call[1] === "job_interviews"
    );
    expect(interviewCall?.[4]).toEqual(staffPermissions);
    // The token was claimed atomically before the interview was created.
    expect(db.incrementRowColumn).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: "recruitment_booking_tokens",
        rowId: "token-row-1",
        column: "claim_lock",
      })
    );
  });

  it("rejects a token whose atomic claim was already taken", async () => {
    mockHappyPath();
    db.incrementRowColumn.mockResolvedValue({ claim_lock: 2 });

    const result = await confirmBookingSlot(
      "booking-token",
      "2026-07-01T10:00:00.000Z",
      30
    );

    expect(result).toEqual({
      error: "This booking link has already been used.",
    });
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
    // The loser undoes its own increment so the lock can't drift above 1 and
    // strand the token as permanently "used".
    expect(db.decrementRowColumn).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: "recruitment_booking_tokens",
        rowId: "token-row-1",
        column: "claim_lock",
        value: 1,
        min: 0,
      })
    );
  });

  it("keeps the claim (no release) when the interview was created but the token update fails", async () => {
    mockHappyPath();
    // Interview row creation succeeds; marking the token consumed then fails.
    db.updateRow.mockRejectedValue(new Error("appwrite timeout"));

    const result = await confirmBookingSlot(
      "booking-token",
      "2026-07-01T10:00:00.000Z",
      30
    );

    expect(result).toEqual({
      error: "Could not confirm the booking. Please try again.",
    });
    // The interview exists, so the claim must NOT be handed back — releasing it
    // would let the candidate book a second interview for the same application.
    expect(db.decrementRowColumn).not.toHaveBeenCalled();
  });

  it("rejects an overlapping interviewer slot and releases the claim", async () => {
    mockHappyPath({ overlappingInterviews: [{ $id: "interview-existing" }] });

    const result = await confirmBookingSlot(
      "booking-token",
      "2026-07-01T10:00:00.000Z",
      30
    );

    expect(result).toEqual({
      error:
        "That time was just booked by someone else. Please pick another slot.",
    });
    expect(db.createRow).not.toHaveBeenCalled();
    // The claim is handed back so the candidate can pick a different slot.
    expect(db.decrementRowColumn).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: "recruitment_booking_tokens",
        rowId: "token-row-1",
        column: "claim_lock",
      })
    );
  });
});
