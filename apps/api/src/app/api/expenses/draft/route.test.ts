import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  updateRow: vi.fn(),
}));

const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  updateRow: vi.fn(),
}));

const storage = vi.hoisted(() => ({
  deleteFile: vi.fn(),
}));

const account = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account, db: sessionDb })),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb, storage })),
}));

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled: vi.fn(async () => true),
}));

import { POST } from "./route";

const DRAFT_BODY = {
  bank_account: "1234.56.78901",
  campus: "1",
  department: "dept-1",
  total: 100,
};

function draftRequest(body: Record<string, unknown>) {
  return new Request("https://api.example/expenses/draft", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  }) as never;
}

describe("expense draft route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    account.get.mockResolvedValue({ $id: "submitter-1" });
    adminDb.createRow.mockResolvedValue({ $id: "expense-1" });
    adminDb.updateRow.mockResolvedValue({ $id: "expense-1" });
  });

  it("creates new drafts through the admin client, readable by the submitter only", async () => {
    const response = await POST(draftRequest(DRAFT_BODY));

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
      ['read("user:submitter-1")']
    );
  });

  it("updates an owned draft through the admin client, never the caller's session", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      status: "draft",
      userId: "submitter-1",
    });

    const response = await POST(
      draftRequest({ ...DRAFT_BODY, expenseId: "expense-1", total: 250 })
    );

    expect(response.status).toBe(200);
    expect(sessionDb.updateRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "expense",
      "expense-1",
      expect.objectContaining({ status: "draft", total: 250 })
    );
  });

  it("refuses to update an expense that belongs to someone else", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      status: "draft",
      userId: "someone-else",
    });

    const response = await POST(
      draftRequest({ ...DRAFT_BODY, expenseId: "expense-1" })
    );

    expect(response.status).toBe(403);
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  it("refuses to update an expense that has left draft", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      status: "pending",
      userId: "submitter-1",
    });

    const response = await POST(
      draftRequest({ ...DRAFT_BODY, expenseId: "expense-1" })
    );

    expect(response.status).toBe(409);
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });
});
