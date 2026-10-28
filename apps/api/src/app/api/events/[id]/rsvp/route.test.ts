import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const rsvp = vi.hoisted(() => ({
  readEventRsvp: vi.fn(),
  setEventRsvp: vi.fn(),
}));
const memberCheck = vi.hoisted(() => ({ isMemberByProfile: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: {} })),
}));
vi.mock("@/lib/member-by-profile", () => memberCheck);
vi.mock("@repo/shared/utils/event-rsvp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/shared/utils/event-rsvp")>()),
  readEventRsvp: rsvp.readEventRsvp,
  setEventRsvp: rsvp.setEventRsvp,
}));

import { GET, POST } from "./route";

const SUMMARY = { counts: { going: 3, maybe: 1 }, mine: null, open: true };
const ctx = (id = "event-1") => ({ params: Promise.resolve({ id }) });

function request(method: "GET" | "POST", body?: unknown, token = "jwt") {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return new Request("https://api.example/api/events/event-1/rsvp", {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
    method,
  }) as never;
}

describe("/api/events/[id]/rsvp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    account.get.mockResolvedValue({
      $id: "user-1",
      email: "a@bi.no",
      name: "Ada",
    });
    rsvp.readEventRsvp.mockResolvedValue(SUMMARY);
    rsvp.setEventRsvp.mockResolvedValue({ ok: true, summary: SUMMARY });
  });

  it("GET without a token returns counts with mine null", async () => {
    const response = await GET(request("GET", undefined, ""), ctx());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(SUMMARY);
    expect(rsvp.readEventRsvp).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventId: "event-1", userId: null })
    );
  });

  it("GET with a token passes the user id", async () => {
    await GET(request("GET"), ctx());

    expect(rsvp.readEventRsvp).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "user-1" })
    );
  });

  it("GET with a refused token is 401 not_authenticated", async () => {
    account.get.mockRejectedValue(new Error("nope"));
    const response = await GET(request("GET"), ctx());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "not_authenticated" });
  });

  it("GET for a missing event is 404 not_found", async () => {
    rsvp.readEventRsvp.mockResolvedValue(null);
    const response = await GET(request("GET"), ctx());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("POST without a token is 401", async () => {
    const response = await POST(
      request("POST", { status: "going" }, ""),
      ctx()
    );

    expect(response.status).toBe(401);
    expect(rsvp.setEventRsvp).not.toHaveBeenCalled();
  });

  it("POST from an anonymous account is 401", async () => {
    account.get.mockResolvedValue({ $id: "g", email: "", name: "guest_x" });
    const response = await POST(request("POST", { status: "going" }), ctx());

    expect(response.status).toBe(401);
    expect(rsvp.setEventRsvp).not.toHaveBeenCalled();
  });

  it('POST with status "yes" is 400 invalid_request', async () => {
    const response = await POST(request("POST", { status: "yes" }), ctx());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });

  it("POST maps closed to 409, members_only to 403, not_found to 404", async () => {
    const cases = [
      ["closed", 409],
      ["members_only", 403],
      ["not_found", 404],
    ] as const;
    for (const [reason, status] of cases) {
      rsvp.setEventRsvp.mockResolvedValue({ ok: false, reason });
      const response = await POST(request("POST", { status: "going" }), ctx());
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: reason });
    }
  });

  it("POST returns the summary on success", async () => {
    const response = await POST(request("POST", { status: null }), ctx());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SUMMARY);
    expect(rsvp.setEventRsvp).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventId: "event-1",
        status: null,
        userId: "user-1",
      })
    );
  });

  it("a malformed event id is 404 without reading", async () => {
    const response = await GET(request("GET"), ctx("../bad id"));

    expect(response.status).toBe(404);
    expect(rsvp.readEventRsvp).not.toHaveBeenCalled();
  });

  it("a thrown error is 503 unavailable", async () => {
    rsvp.setEventRsvp.mockRejectedValue(new Error("boom"));
    const response = await POST(request("POST", { status: "going" }), ctx());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });
});
