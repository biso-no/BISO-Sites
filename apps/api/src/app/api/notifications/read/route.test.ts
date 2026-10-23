import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb })),
}));

import { POST } from "./route";

function readRequest(body: unknown, authorization = "Bearer jwt") {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return new Request("https://api.example/api/notifications/read", {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  }) as never;
}

describe("POST /api/notifications/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    account.get.mockResolvedValue({ $id: "user-1" });
    // Every asked-for announcement exists; the student has no rows yet.
    adminDb.listRows.mockImplementation(
      (_db: string, table: string, queries: string[]) => {
        if (table !== "announcements") {
          return Promise.resolve({ rows: [] });
        }
        const idQuery = JSON.parse(queries[0] ?? "{}") as { values?: string[] };
        return Promise.resolve({
          rows: (idQuery.values ?? []).map(($id) => ({ $id })),
        });
      }
    );
    adminDb.createRow.mockResolvedValue({});
    adminDb.updateRow.mockResolvedValue({});
  });

  it("requires a bearer token", async () => {
    const response = await POST(readRequest({ announcementIds: ["a1"] }, ""));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "not_authenticated" });
    expect(adminDb.listRows).not.toHaveBeenCalled();
  });

  it("refuses a token Appwrite does not accept", async () => {
    account.get.mockRejectedValue(new Error("invalid jwt"));

    const response = await POST(readRequest({ announcementIds: ["a1"] }));

    expect(response.status).toBe(401);
    expect(adminDb.listRows).not.toHaveBeenCalled();
  });

  it("refuses a body without valid ids", async () => {
    const response = await POST(readRequest({ announcementIds: [] }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(adminDb.listRows).not.toHaveBeenCalled();
  });

  it("writes for the token's account, never one from the body", async () => {
    const response = await POST(
      readRequest({ announcementIds: ["a1"], userId: "someone-else" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "user_notifications",
      expect.any(String),
      { announcement_id: "a1", cleared: false, read: true, user_id: "user-1" },
      ['read("user:user-1")']
    );
  });

  it("answers unavailable when a write fails", async () => {
    adminDb.createRow.mockRejectedValue(
      Object.assign(new Error("boom"), { code: 500 })
    );

    const response = await POST(readRequest({ announcementIds: ["a1"] }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });

  it("limits each student to 60 requests a minute", async () => {
    account.get.mockResolvedValue({ $id: "busy-student" });

    for (let i = 0; i < 60; i++) {
      const ok = await POST(readRequest({ announcementIds: ["a1"] }));
      expect(ok.status).toBe(200);
    }
    const response = await POST(readRequest({ announcementIds: ["a1"] }));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
  });

  it("is never cached", async () => {
    const response = await POST(readRequest({ announcementIds: ["a1"] }));

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
