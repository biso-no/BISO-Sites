import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  updateRow: vi.fn(),
}));
const users = vi.hoisted(() => ({ updateName: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb, users })),
}));

import { PUT } from "./route";

function profileRequest(body: unknown, authorization = "Bearer jwt") {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return new Request("https://api.example/api/profile", {
    body: JSON.stringify(body),
    headers,
    method: "PUT",
  }) as never;
}

describe("PUT /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    account.get.mockResolvedValue({
      $id: "user-1",
      email: "ada@example.com",
      name: "Ada",
    });
    adminDb.updateRow.mockResolvedValue({ $id: "user-1", name: "Ada L" });
    adminDb.createRow.mockResolvedValue({ $id: "user-1", name: "Ada" });
    users.updateName.mockResolvedValue({});
  });

  it("requires a bearer token", async () => {
    const response = await PUT(profileRequest({ name: "Ada" }, ""));

    expect(response.status).toBe(401);
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  it("rejects values the profile columns cannot hold", async () => {
    const response = await PUT(profileRequest({ name: "x".repeat(31) }));

    expect(response.status).toBe(400);
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  it("updates an existing row with self-service fields only and mirrors a changed name", async () => {
    adminDb.getRow.mockResolvedValue({ $id: "user-1" });

    const response = await PUT(
      profileRequest({
        bi_employee_id: "1015882",
        is_public: true,
        name: "Ada L",
        student_id: "s1715738",
      })
    );

    expect(response.status).toBe(200);
    expect(adminDb.updateRow).toHaveBeenCalledWith("app", "user", "user-1", {
      is_public: true,
      name: "Ada L",
    });
    expect(users.updateName).toHaveBeenCalledWith({
      name: "Ada L",
      userId: "user-1",
    });
  });

  it("creates a missing row with the account email, readable by its owner only", async () => {
    adminDb.getRow.mockRejectedValue(
      Object.assign(new Error("not found"), { code: 404 })
    );

    const response = await PUT(profileRequest({ campus_id: "1", name: "Ada" }));

    expect(response.status).toBe(200);
    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      { campus_id: "1", email: "ada@example.com", name: "Ada" },
      ['read("user:user-1")']
    );
    expect(users.updateName).not.toHaveBeenCalled();
  });

  it("answers 500 without creating anything when the lookup fails", async () => {
    adminDb.getRow.mockRejectedValue(
      Object.assign(new Error("timeout"), { code: 500 })
    );

    const response = await PUT(profileRequest({ name: "Ada" }));

    expect(response.status).toBe(500);
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });
});
