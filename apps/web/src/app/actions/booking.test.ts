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

const graph = vi.hoisted(() => ({
  busy: [] as { end: string; start: string }[],
  client: {} as object | null,
  schedule: vi.fn(),
}));

vi.mock("@repo/connectors/azure/recruitment-scheduling", () => ({
  createSchedulingGraphClient: () => graph.client,
  panelBusyIntervals: vi.fn(async () => ({ busy: graph.busy, complete: true })),
  scheduleInterviewOnGraph: (...args: unknown[]) => graph.schedule(...args),
}));

import { confirmBookingSlot, getBookingContext } from "./booking";

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
  panel_user_ids: JSON.stringify([
    {
      display_name: "Panel One",
      email: "panel@biso.no",
      is_lead: true,
      user_id: "panel-1",
    },
  ]),
  token_hash: tokenHash("booking-token"),
  window_from: "2027-07-01T09:00:00.000Z",
  window_to: "2027-07-01T17:00:00.000Z",
};

function mockHappyPath({
  applicationStatus = "interview",
  jobStatus = "published",
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
      status: applicationStatus,
    })
    .mockResolvedValueOnce({
      $id: "job-1",
      campus: { name: "Oslo" },
      campus_id: "campus-oslo",
      department: { Name: "HR" },
      department_id: "dept-hr",
      status: jobStatus,
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
    graph.busy = [];
    graph.client = {};
    graph.schedule.mockReset();
    graph.schedule.mockResolvedValue({
      meetingUrl: "https://teams.microsoft.com/l/meetup-join/abc",
      outlookEventId: "event-1",
      teamsMeetingId: "meeting-1",
      webLink: null,
    });
  });

  it("offers only slots where the panel is free, in office hours", async () => {
    // Slots used to be invented hourly from the window start with no
    // calendar check, and the page then promised an invite nobody sent.
    db.listRows.mockResolvedValue({ rows: [tokenRow], total: 1 });
    db.getRow
      .mockResolvedValueOnce({
        applicant_email: "c@x.no",
        applicant_name: "C",
        job_id: "job-1",
        status: "interview",
      })
      .mockResolvedValueOnce({
        $id: "job-1",
        campus: { name: "Oslo" },
        slug: "role",
      });
    graph.busy = [
      { end: "2027-07-01T11:00:00.000Z", start: "2027-07-01T10:00:00.000Z" },
    ];

    const result = await getBookingContext("booking-token");

    if ("error" in result) {
      throw new Error(result.error);
    }
    expect(result.data.availabilityChecked).toBe(true);
    // Window is 09:00-17:00 UTC = 11:00-19:00 Oslo; office hours end 17:00
    // Oslo = 15:00 UTC, so the last 30-minute slot starts 14:30 UTC.
    expect(result.data.slots[0]).toBe("2027-07-01T09:00:00.000Z");
    expect(result.data.slots.at(-1)).toBe("2027-07-01T14:30:00.000Z");
    expect(result.data.slots).not.toContain("2027-07-01T10:00:00.000Z");
    expect(result.data.slots).not.toContain("2027-07-01T10:30:00.000Z");
  });

  it("invites the candidate and the panel when a slot is confirmed", async () => {
    mockHappyPath();

    const result = await confirmBookingSlot(
      "booking-token",
      "2027-07-01T10:00:00.000Z"
    );

    expect(result).toEqual({
      data: {
        interview_id: expect.any(String),
        invited: true,
        starts_at: "2027-07-01T10:00:00.000Z",
      },
    });
    const participants = db.createRow.mock.calls
      .filter((call: unknown[]) => call[1] === "job_interview_participants")
      .map((call: unknown[]) => call[3] as { email: string; role: string });
    expect(participants.map((p) => p.email).sort()).toEqual([
      "candidate@example.com",
      "panel@biso.no",
    ]);
    expect(graph.schedule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        candidateEmail: "candidate@example.com",
        createTeamsMeeting: true,
        panelEmails: ["panel@biso.no"],
      })
    );
    const interviewCall = db.createRow.mock.calls.find(
      (call: unknown[]) => call[1] === "job_interviews"
    );
    // The interview length comes from the token, never from the browser.
    expect((interviewCall?.[3] as { ends_at: string }).ends_at).toBe(
      "2027-07-01T10:30:00.000Z"
    );
  });

  it("says so when no invite could be sent", async () => {
    mockHappyPath();
    graph.client = null;

    const result = await confirmBookingSlot(
      "booking-token",
      "2027-07-01T10:00:00.000Z"
    );

    expect(result).toEqual({
      data: {
        interview_id: expect.any(String),
        invited: false,
        starts_at: "2027-07-01T10:00:00.000Z",
      },
    });
  });

  it("refuses a slot outside office hours even if it is inside the window", async () => {
    mockHappyPath();

    const result = await confirmBookingSlot(
      "booking-token",
      "2027-07-01T16:00:00.000Z" // 18:00 Oslo
    );

    expect(result).toEqual({ error: "That time is no longer available." });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("stamps candidate-booked interviews with recruitment staff permissions", async () => {
    mockHappyPath();

    const result = await confirmBookingSlot(
      "booking-token",
      "2027-07-01T10:00:00.000Z"
    );

    expect(result).toEqual({
      data: {
        interview_id: expect.any(String),
        invited: true,
        starts_at: "2027-07-01T10:00:00.000Z",
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

  it("refuses a link once the candidate has left the interview stage", async () => {
    for (const applicationStatus of ["rejected", "accepted", "reviewed"]) {
      mockHappyPath({ applicationStatus });
      const context = await getBookingContext("booking-token");
      expect(context).toEqual({ error: "This booking link has expired." });

      mockHappyPath({ applicationStatus });
      const confirmed = await confirmBookingSlot(
        "booking-token",
        "2027-07-01T10:00:00.000Z"
      );
      expect(confirmed).toEqual({ error: "This booking link has expired." });
    }
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("refuses a link once the vacancy is closed", async () => {
    mockHappyPath({ jobStatus: "closed" });
    expect(await getBookingContext("booking-token")).toEqual({
      error: "This booking link has expired.",
    });

    mockHappyPath({ jobStatus: "closed" });
    expect(
      await confirmBookingSlot("booking-token", "2027-07-01T10:00:00.000Z")
    ).toEqual({ error: "This booking link has expired." });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("rejects a token whose atomic claim was already taken", async () => {
    mockHappyPath();
    db.incrementRowColumn.mockResolvedValue({ claim_lock: 2 });

    const result = await confirmBookingSlot(
      "booking-token",
      "2027-07-01T10:00:00.000Z"
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
      "2027-07-01T10:00:00.000Z"
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
      "2027-07-01T10:00:00.000Z"
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
