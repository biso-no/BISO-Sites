import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  updateRow: vi.fn(),
}));

const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
}));

const account = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account, db: sessionDb })),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb })),
}));

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled: vi.fn(async () => true),
}));

import { POST } from "./route";

function draftRequest(body: Record<string, unknown>) {
  return new Request("https://api.example/expenses/draft", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  }) as never;
}

describe("expense draft route", () => {
  beforeEach(() => {
    account.get.mockReset();
    adminDb.createRow.mockReset();
    sessionDb.createRow.mockReset();
    sessionDb.getRow.mockReset();
    sessionDb.updateRow.mockReset();

    account.get.mockResolvedValue({ $id: "submitter-1" });
    adminDb.createRow.mockResolvedValue({ $id: "expense-1" });
  });

  it("creates new draft expenses through the admin client with submitter permissions", async () => {
    const response = await POST(
      draftRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        total: 100,
      })
    );

    expect(response.status).toBe(200);
    expect(sessionDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "expense",
      expect.any(String),
      expect.objectContaining({
        status: "draft",
        total: 100,
        userId: "submitter-1",
      }),
      ['read("user:submitter-1")', 'update("user:submitter-1")']
    );
  });
});
