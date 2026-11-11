import { ExpensesStatus } from "@repo/api/types/appwrite";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const enrichment = vi.hoisted(() => {
  class OccasionRequiredError extends Error {}
  return { enrichSubmission: vi.fn(), OccasionRequiredError };
});

vi.mock("@/lib/expense-submission", () => enrichment);

vi.mock("@/lib/pdf/expense-pdf", () => ({
  generateExpensePdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

vi.mock("@repo/api/file", () => ({
  InputFile: {
    fromBuffer: vi.fn(() => ({ file: "pdf" })),
  },
}));

import { createApprovalChain } from "@/lib/expense-approval";
import { POST } from "./route";

const PROFILE = {
  $id: "submitter-1",
  address: "Street 1",
  bank_account: "1234.56.78901",
  city: "Oslo",
  email: "ada@example.com",
  name: "Ada Lovelace",
  phone: "12345678",
  zip: "0001",
};

const SAVED_EXPENSE = {
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
};

const SUBMIT_BODY = {
  bank_account: "1234.56.78901",
  campus: "1",
  department: "dept-1",
  total: 100,
};

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
    vi.mocked(createApprovalChain).mockClear();
    enrichment.enrichSubmission.mockReset();
    enrichment.enrichSubmission.mockResolvedValue(undefined);
    // The profile, then the saved draft (read before and after enrichment).
    sessionDb.getRow
      .mockResolvedValueOnce(PROFILE)
      .mockResolvedValue(SAVED_EXPENSE);
    adminDb.createRow.mockResolvedValue({ $id: "expense-1" });
    adminDb.updateRow.mockResolvedValue({});
    storage.createFile.mockResolvedValue({ $id: "pdf-1" });
    messaging.createEmail.mockResolvedValue({});
    sessionDb.updateRow.mockResolvedValue({});
    vi.stubEnv("INVOICE_USER_ID", "invoice-user");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("keeps a web draft's own type text and occasion when an old app submits it", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      event_id: "event-1",
      expenseAttachments: [
        {
          $id: "att-1",
          cost_type: "",
          cost_type_text: "Flowers",
          url: "file-1",
        },
      ],
      occasion: "Board meeting",
      status: ExpensesStatus.DRAFT,
      userId: "submitter-1",
    });

    const response = await POST(
      submitRequest({
        ...SUBMIT_BODY,
        expenseAttachments: [
          { amount: 100, cost_type: "social", url: "file-1" },
        ],
        expenseId: "expense-1",
      })
    );

    expect(response.status).toBe(200);
    const [, , , select] = adminDb.getRow.mock.calls[0] ?? [];
    for (const column of ["expenseAttachments.*", "occasion", "event_id"]) {
      expect(select?.[0]).toContain(column);
    }
    const saved = adminDb.updateRow.mock.calls.find(
      ([, table]) => table === "expense"
    )?.[3];
    expect(saved).toMatchObject({
      event_id: "event-1",
      expenseAttachments: [
        expect.objectContaining({ cost_type: "", cost_type_text: "Flowers" }),
      ],
      occasion: "Board meeting",
    });
    // Enrichment decides from the merged payload, not the app's default slug.
    const [, , enrichedPayload] =
      enrichment.enrichSubmission.mock.calls[0] ?? [];
    expect(enrichedPayload).toMatchObject({
      expenseAttachments: [
        expect.objectContaining({ cost_type: "", cost_type_text: "Flowers" }),
      ],
      occasion: "Board meeting",
    });
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
    expect(messaging.createEmail).toHaveBeenCalledWith(
      expect.objectContaining({ html: true, users: ["submitter-1"] })
    );
    expect(messaging.createEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: ["expenses:pdf-1"],
        html: true,
        users: ["invoice-user"],
      })
    );
  });

  it("fails before emailing anyone when INVOICE_USER_ID is unset", async () => {
    vi.stubEnv("INVOICE_USER_ID", "");

    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        total: 100,
      })
    );

    expect(response.status).toBe(500);
    expect(storage.createFile).not.toHaveBeenCalled();
    expect(messaging.createEmail).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  it("answers 409 when a concurrent submit already created the approval chain", async () => {
    vi.mocked(isFeatureEnabled)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    vi.mocked(createApprovalChain).mockRejectedValueOnce(
      Object.assign(new Error("Row already exists"), { code: 409 })
    );

    const response = await POST(
      submitRequest({
        bank_account: "1234.56.78901",
        campus: "1",
        department: "dept-1",
        total: 100,
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "This expense is already being submitted.",
    });
    expect(messaging.createEmail).not.toHaveBeenCalled();
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
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });
  it("reads the occasion and event with the expense it enriches", async () => {
    vi.mocked(isFeatureEnabled)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    sessionDb.getRow.mockReset();
    sessionDb.getRow
      .mockResolvedValueOnce(PROFILE)
      .mockResolvedValueOnce(SAVED_EXPENSE)
      .mockResolvedValueOnce(SAVED_EXPENSE);

    const response = await POST(submitRequest(SUBMIT_BODY));

    expect(response.status).toBe(200);
    // The enrichment read is the second getRow; without these columns a new
    // client that omits the occasion would lose the stored one.
    const [, , , select] = sessionDb.getRow.mock.calls[1] ?? [];
    for (const column of ["occasion", "event_id"]) {
      expect(select?.[0]).toContain(column);
    }
  });

  it("calls enrichSubmission before the approval chain", async () => {
    vi.mocked(isFeatureEnabled)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    sessionDb.getRow.mockReset();
    sessionDb.getRow
      .mockResolvedValueOnce(PROFILE)
      .mockResolvedValueOnce(SAVED_EXPENSE)
      .mockResolvedValueOnce({ ...SAVED_EXPENSE, description: "Enriched" });

    const response = await POST(
      submitRequest({ ...SUBMIT_BODY, occasion: "Board meeting" })
    );

    expect(response.status).toBe(200);
    expect(enrichment.enrichSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ db: adminDb, storage }),
      expect.objectContaining({ $id: "expense-1", description: "Travel" }),
      expect.objectContaining({ occasion: "Board meeting", total: 100 }),
      "Ada Lovelace"
    );
    const enrichedAt =
      enrichment.enrichSubmission.mock.invocationCallOrder[0] ?? 0;
    expect(enrichedAt).toBeLessThan(
      vi.mocked(createApprovalChain).mock.invocationCallOrder[0] ?? 0
    );
    // The approval chain sees the expense as stored after enrichment.
    expect(sessionDb.getRow).toHaveBeenCalledTimes(3);
    expect(sessionDb.getRow.mock.invocationCallOrder[2] ?? 0).toBeGreaterThan(
      enrichedAt
    );
    expect(createApprovalChain).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Enriched",
        expenseId: "expense-1",
      })
    );
  });

  it("answers 400 with the occasion field when a type asks for one", async () => {
    enrichment.enrichSubmission.mockRejectedValueOnce(
      new enrichment.OccasionRequiredError("Occasion is required")
    );

    const response = await POST(submitRequest(SUBMIT_BODY));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Occasion is required",
      // The draft saved before the check, so the client can update it.
      expenseId: "expense-1",
      field: "occasion",
      success: false,
    });
    expect(adminDb.createRow).toHaveBeenCalledTimes(1);
    expect(createApprovalChain).not.toHaveBeenCalled();
    expect(messaging.createEmail).not.toHaveBeenCalled();
  });

  it("never returns account numbers to the student", async () => {
    sessionDb.getRow.mockReset();
    sessionDb.getRow.mockResolvedValueOnce(PROFILE).mockResolvedValue({
      ...SAVED_EXPENSE,
      expenseAttachments: [
        {
          $id: "att-1",
          account_number: 7310,
          account_source: "ai_freeform",
          amount: 100,
          cost_type: "social",
          tax_code: 1,
          url: "file-1",
        },
      ],
    });

    const response = await POST(submitRequest(SUBMIT_BODY));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fetchedExpense.expenseAttachments).toEqual([
      {
        $id: "att-1",
        account_number: null,
        account_source: null,
        amount: 100,
        cost_type: "social",
        tax_code: null,
        url: "file-1",
      },
    ]);
  });
});
