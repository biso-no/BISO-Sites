import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
}));
const membership = vi.hoisted(() => ({ getLiveMembershipStatus: vi.fn() }));
const authState = vi.hoisted(() => ({ authenticated: true }));
const rsvp = vi.hoisted(() => ({ setEventRsvp: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb })),
  createSessionClient: vi.fn(async () => ({ account, db: adminDb })),
}));
vi.mock("@/lib/auth-utils", () => ({
  isAuthenticatedAccount: vi.fn(() => authState.authenticated),
}));
vi.mock("@/lib/actions/membership", () => membership);
vi.mock("@repo/shared/utils/event-rsvp", async (orig) => ({
  ...(await orig<typeof import("@repo/shared/utils/event-rsvp")>()),
  setEventRsvp: rsvp.setEventRsvp,
}));

import { respondToEvent } from "./event-rsvp";

const summary = { counts: { going: 2, maybe: 1 }, mine: "going", open: true };

describe("respondToEvent", () => {
  beforeEach(() => {
    account.get.mockReset();
    rsvp.setEventRsvp.mockReset();
    membership.getLiveMembershipStatus.mockReset();
    authState.authenticated = true;
    account.get.mockResolvedValue({ $id: "user-1" });
  });

  it("refuses an anonymous session without writing", async () => {
    authState.authenticated = false;
    const result = await respondToEvent("event-1", "going");
    expect(result).toEqual({ success: false, error: "not_authenticated" });
    expect(rsvp.setEventRsvp).not.toHaveBeenCalled();
  });

  it("refuses a missing session", async () => {
    account.get.mockRejectedValue(new Error("401"));
    const result = await respondToEvent("event-1", "going");
    expect(result).toEqual({ success: false, error: "not_authenticated" });
    expect(rsvp.setEventRsvp).not.toHaveBeenCalled();
  });

  it("rejects an unknown status", async () => {
    const result = await respondToEvent("event-1", "yes" as never);
    expect(result).toEqual({ success: false, error: "invalid_request" });
    expect(rsvp.setEventRsvp).not.toHaveBeenCalled();
  });

  it("returns the summary", async () => {
    rsvp.setEventRsvp.mockResolvedValue({ ok: true, summary });
    const result = await respondToEvent("event-1", "going");
    expect(result).toEqual({ success: true, data: summary });
    expect(rsvp.setEventRsvp.mock.calls[0][1]).toMatchObject({
      eventId: "event-1",
      status: "going",
      userId: "user-1",
    });
  });

  it("maps members_only and closed", async () => {
    rsvp.setEventRsvp.mockResolvedValueOnce({
      ok: false,
      reason: "members_only",
    });
    expect(await respondToEvent("event-1", "going")).toEqual({
      success: false,
      error: "members_only",
    });
    rsvp.setEventRsvp.mockResolvedValueOnce({ ok: false, reason: "closed" });
    expect(await respondToEvent("event-1", "maybe")).toEqual({
      success: false,
      error: "closed",
    });
  });

  it("maps a thrown error to unavailable", async () => {
    rsvp.setEventRsvp.mockRejectedValue(new Error("boom"));
    expect(await respondToEvent("event-1", "going")).toEqual({
      success: false,
      error: "unavailable",
    });
  });

  it("asks live membership only through the isMember callback", async () => {
    membership.getLiveMembershipStatus.mockResolvedValue({ isMember: true });
    rsvp.setEventRsvp.mockResolvedValue({ ok: true, summary });
    await respondToEvent("event-1", "going");
    expect(membership.getLiveMembershipStatus).not.toHaveBeenCalled();
    const { isMember } = rsvp.setEventRsvp.mock.calls[0][1];
    expect(await isMember()).toBe(true);
    expect(membership.getLiveMembershipStatus).toHaveBeenCalledTimes(1);
  });
});
