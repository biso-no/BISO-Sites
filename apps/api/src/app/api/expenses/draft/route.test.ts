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

import { DELETE, POST } from "./route";

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

function deleteRequest(query: string) {
  return new Request(`https://api.example/api/expenses/draft${query}`, {
    method: "DELETE",
  }) as never;
}

describe("expense draft deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    account.get.mockResolvedValue({ $id: "submitter-1" });
    adminDb.deleteRow.mockResolvedValue({});
    storage.deleteFile.mockResolvedValue({});
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("requires a signed-in caller", async () => {
    account.get.mockRejectedValue(new Error("no session"));

    const response = await DELETE(deleteRequest("?expenseId=expense-1"));

    expect(response.status).toBe(401);
    expect(adminDb.deleteRow).not.toHaveBeenCalled();
  });

  it("requires an expense id", async () => {
    const response = await DELETE(deleteRequest(""));

    expect(response.status).toBe(400);
  });

  it("answers 404 for an expense that does not exist", async () => {
    adminDb.getRow.mockRejectedValue(
      Object.assign(new Error("row_not_found"), { code: 404 })
    );

    const response = await DELETE(deleteRequest("?expenseId=expense-1"));

    expect(response.status).toBe(404);
  });

  it("refuses to delete someone else's expense", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      expenseAttachments: [],
      status: "draft",
      userId: "someone-else",
    });

    const response = await DELETE(deleteRequest("?expenseId=expense-1"));

    expect(response.status).toBe(403);
    expect(adminDb.deleteRow).not.toHaveBeenCalled();
  });

  it("refuses to delete an expense that has been submitted", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      expenseAttachments: [],
      status: "pending",
      userId: "submitter-1",
    });

    const response = await DELETE(deleteRequest("?expenseId=expense-1"));

    expect(response.status).toBe(409);
    expect(adminDb.deleteRow).not.toHaveBeenCalled();
  });

  it("deletes an owned draft and its receipt files, even if a file is already gone", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      expenseAttachments: [{ url: "file-1" }, { url: "file-2" }],
      status: "draft",
      userId: "submitter-1",
    });
    storage.deleteFile
      .mockRejectedValueOnce(new Error("file not found"))
      .mockResolvedValueOnce({});

    const response = await DELETE(deleteRequest("?expenseId=expense-1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(adminDb.deleteRow).toHaveBeenCalledWith(
      "app",
      "expense",
      "expense-1"
    );
    expect(storage.deleteFile).toHaveBeenCalledWith("expenses", "file-1");
    expect(storage.deleteFile).toHaveBeenCalledWith("expenses", "file-2");
  });
});
