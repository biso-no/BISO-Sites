import { ExpensesStatus } from "@repo/api/types/appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  updateRow: vi.fn(),
}));

const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  updateRow: vi.fn(),
}));

const account = vi.hoisted(() => ({
  get: vi.fn(),
}));

const messaging = vi.hoisted(() => ({
  createEmail: vi.fn(),
}));

const storage = vi.hoisted(() => ({
  createFile: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account, db: sessionDb })),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb, messaging, storage })),
}));

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled: vi.fn(
    async (key: string) => key !== "expenses_ledger_posting"
  ),
}));

vi.mock("@/lib/expense-approval", () => ({
  createApprovalChain: vi.fn(async () => undefined),
}));

vi.mock("@/lib/pdf/expense-pdf", () => ({
  generateExpensePdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

vi.mock("@repo/api/file", () => ({
  InputFile: {
    fromBuffer: vi.fn(() => ({ file: "pdf" })),
  },
}));

import { POST } from "./route";

function submitRequest(body: Record<string, unknown>) {
  return new Request("https://api.example/expenses/submit", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  }) as never;
}

describe("expense submit route", () => {
  beforeEach(() => {
    account.get.mockReset();
    adminDb.createRow.mockReset();
    adminDb.getRow.mockReset();
    adminDb.updateRow.mockReset();
    sessionDb.createRow.mockReset();
    sessionDb.getRow.mockReset();
    sessionDb.updateRow.mockReset();
    messaging.createEmail.mockReset();
    storage.createFile.mockReset();

    account.get.mockResolvedValue({ $id: "submitter-1" });
    sessionDb.getRow
      .mockResolvedValueOnce({
        $id: "submitter-1",
        address: "Street 1",
        bank_account: "1234.56.78901",
        city: "Oslo",
        email: "ada@example.com",
        name: "Ada Lovelace",
        phone: "12345678",
        zip: "0001",
      })
      .mockResolvedValueOnce({
        $id: "expense-1",
        $sequence: 42,
        bank_account: "1234.56.78901",
        campus: "1",
        campusRel: { name: "Oslo" },
        department: "dept-1",
        departmentRel: { Name: "Operations Unit" },
        description: "Travel",
        expenseAttachments: [],
        prepayment_amount: null,
        status: ExpensesStatus.DRAFT,
        total: 100,
        userId: "submitter-1",
      });
    adminDb.createRow.mockResolvedValue({ $id: "expense-1" });
    adminDb.updateRow.mockResolvedValue({});
    storage.createFile.mockResolvedValue({ $id: "pdf-1" });
    messaging.createEmail.mockResolvedValue({});
    sessionDb.updateRow.mockResolvedValue({});
  });

  it("creates submitted expense rows through the admin client with submitter permissions", async () => {
    const response = await POST(
      submitRequest({
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
        status: ExpensesStatus.DRAFT,
        total: 100,
        userId: "submitter-1",
      }),
      ['read("user:submitter-1")']
    );
  });

  it("updates an owned draft through the admin client before submitting it", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      status: ExpensesStatus.DRAFT,
      userId: "submitter-1",
    });

    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        expenseId: "expense-1",
        total: 100,
      })
    );

    expect(response.status).toBe(200);
    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "expense",
      "expense-1",
      expect.objectContaining({ status: ExpensesStatus.DRAFT, total: 100 })
    );
    expect(sessionDb.updateRow).not.toHaveBeenCalled();
  });

  it("refuses to submit an expense that belongs to someone else", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      status: ExpensesStatus.DRAFT,
      userId: "someone-else",
    });

    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        expenseId: "expense-1",
        total: 100,
      })
    );

    expect(response.status).toBe(403);
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  it("marks a legacy-flow submission pending through the admin client", async () => {
    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        total: 100,
      })
    );

    expect(response.status).toBe(200);
    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "expense",
      "expense-1",
      { status: ExpensesStatus.PENDING }
    );
    expect(sessionDb.updateRow).not.toHaveBeenCalled();
  });

  it("answers 401 when the session is rejected by Appwrite", async () => {
    account.get.mockRejectedValue(
      Object.assign(new Error("missing scope"), { code: 401 })
    );

    const response = await POST(submitRequest({}));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    });
  });

  it("answers 400 for a malformed JSON body", async () => {
    const request = new Request("https://api.example/expenses/submit", {
      body: "{not json",
      headers: { "content-type": "application/json" },
      method: "POST",
    }) as never;

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  it("answers 404 when Appwrite reports a missing row", async () => {
    sessionDb.getRow.mockReset();
    sessionDb.getRow.mockRejectedValue(
      Object.assign(new Error("Row not found"), { code: 404 })
    );

    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        total: 100,
      })
    );

    expect(response.status).toBe(404);
  });

  it("answers 500 with a message string, never the raw error", async () => {
    adminDb.createRow.mockRejectedValue(
      Object.assign(new Error("secret internals"), { code: 503 })
    );

    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        total: 100,
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Failed to submit expense",
    });
  });

  it("answers 400 with missingFields when the profile is incomplete", async () => {
    sessionDb.getRow.mockReset();
    sessionDb.getRow
      .mockResolvedValueOnce({
        $id: "submitter-1",
        bank_account: "1234.56.78901",
        email: "ada@example.com",
        name: "Ada Lovelace",
      })
      .mockResolvedValueOnce({
        $id: "expense-1",
        $sequence: 42,
        expenseAttachments: [],
        total: 100,
      });

    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        total: 100,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      missingFields: "phone",
    });
  });
});
