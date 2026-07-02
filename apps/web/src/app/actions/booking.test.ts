import { createHash } from "node:crypto";
import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  process.env.RECRUITMENT_BOOKING_SECRET = "booking-secret";
  return {
    createRow: vi.fn(),
    getRow: vi.fn(),
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

describe("recruitment booking actions", () => {
  beforeEach(() => {
    (globalThis as { __appwriteMockDb?: unknown }).__appwriteMockDb = db;
    db.createRow.mockReset();
    db.getRow.mockReset();
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
  });

  it("stamps candidate-booked interviews with recruitment staff permissions", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        {
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
        },
      ],
      total: 1,
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
  });
});
