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

describe("POST /api/notifications/clear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    account.get.mockResolvedValue({ $id: "user-1" });
    adminDb.listRows.mockImplementation((_db: string, table: string) =>
      Promise.resolve({
        rows: table === "announcements" ? [{ $id: "a1" }] : [],
      })
    );
    adminDb.createRow.mockResolvedValue({});
  });

  it("clears for the token's account", async () => {
    const response = await POST(
      new Request("https://api.example/api/notifications/clear", {
        body: JSON.stringify({ announcementIds: ["a1"] }),
        headers: { authorization: "Bearer jwt" },
        method: "POST",
      }) as never
    );

    expect(response.status).toBe(200);
    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "user_notifications",
      expect.any(String),
      { announcement_id: "a1", cleared: true, read: true, user_id: "user-1" },
      ['read("user:user-1")']
    );
  });
});
