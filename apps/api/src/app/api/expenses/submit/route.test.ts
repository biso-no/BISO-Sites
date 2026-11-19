import { ExpensesCheckState, ExpensesStatus } from "@repo/api/types/appwrite";
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

const storage = vi.hoisted(() => ({
  getFileDownload: vi.fn(),
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

const check = vi.hoisted(() => ({ runExpenseCheck: vi.fn() }));
vi.mock("@/lib/expense-check/run", () => check);

const scheduled = vi.hoisted(() => ({
  tasks: [] as (() => Promise<void>)[],
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => {
    scheduled.tasks.push(task);
  },
}));

const runScheduled = async () => {
  for (const task of scheduled.tasks) {
    await task();
  }
};

const preparation = vi.hoisted(() => {
  class OccasionRequiredError extends Error {}
  return { OccasionRequiredError, prepareSubmission: vi.fn() };
});

vi.mock("@/lib/expense-submission", () => preparation);

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

const PENDING_EXPENSE = { ...SAVED_EXPENSE, status: ExpensesStatus.PENDING };

/** The write that submits: the student sees `pending`, the check is queued. */
const SUBMITTED_WRITE = {
  check_state: ExpensesCheckState.QUEUED,
  status: ExpensesStatus.PENDING,
};

function submittedWrites() {
  return adminDb.updateRow.mock.calls.filter(
    ([, table, , data]) => table === "expense" && data.status === "pending"
  );
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

    account.get.mockResolvedValue({ $id: "submitter-1" });
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    scheduled.tasks.length = 0;
    check.runExpenseCheck.mockReset();
    check.runExpenseCheck.mockResolvedValue("done");
    preparation.prepareSubmission.mockReset();
    preparation.prepareSubmission.mockResolvedValue(undefined);
    // The profile, the saved draft it prepares, then the submitted expense.
    sessionDb.getRow
      .mockResolvedValueOnce(PROFILE)
      .mockResolvedValueOnce(SAVED_EXPENSE)
      .mockResolvedValue(PENDING_EXPENSE);
    adminDb.createRow.mockResolvedValue({ $id: "expense-1" });
    adminDb.updateRow.mockResolvedValue({});
    sessionDb.updateRow.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submit schedules one check", async () => {
    const response = await POST(submitRequest(SUBMIT_BODY));

    expect(response.status).toBe(200);
    // The answer goes out before the check starts.
    expect(check.runExpenseCheck).not.toHaveBeenCalled();
    expect(scheduled.tasks).toHaveLength(1);
    await runScheduled();
    expect(check.runExpenseCheck).toHaveBeenCalledTimes(1);
    expect(check.runExpenseCheck).toHaveBeenCalledWith("expense-1");
  });

  it("a check that throws is logged after the answer", async () => {
    check.runExpenseCheck.mockRejectedValue(new Error("db down"));
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await POST(submitRequest(SUBMIT_BODY));
    await runScheduled();

    expect(response.status).toBe(200);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("expense-1"),
      expect.any(Error)
    );
  });

  it("marks the expense pending and queues its check once it is prepared", async () => {
    const response = await POST(submitRequest(SUBMIT_BODY));

    expect(response.status).toBe(200);
    expect(submittedWrites()).toEqual([
      ["app", "expense", "expense-1", SUBMITTED_WRITE],
    ]);
    const submittedAt =
      adminDb.updateRow.mock.invocationCallOrder[
        adminDb.updateRow.mock.calls.findIndex(
          ([, , , data]) => data.status === "pending"
        )
      ] ?? 0;
    expect(
      preparation.prepareSubmission.mock.invocationCallOrder[0]
    ).toBeLessThan(submittedAt);
    // The answer is read after the write, so the student sees `pending`.
    expect(sessionDb.getRow.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      submittedAt
    );
    // Nobody is notified from the request any more.
    expect(sessionDb.updateRow).not.toHaveBeenCalled();
  });

  it("the Flutter submit response is unchanged", async () => {
    const response = await POST(submitRequest(SUBMIT_BODY));

    expect(response.status).toBe(200);
    const body = await response.json();
    // ExpenseSubmitResult reads success, fetchedExpense and reimbursementNumber.
    expect(Object.keys(body).sort()).toEqual([
      "fetchedExpense",
      "reimbursementNumber",
      "success",
    ]);
    expect(body.success).toBe(true);
    expect(body.reimbursementNumber).toBe("10042");
    expect(body.fetchedExpense).toMatchObject({
      $id: "expense-1",
      status: "pending",
      total: 100,
    });
  });

  it("occasion is still required at submit", async () => {
    preparation.prepareSubmission.mockRejectedValueOnce(
      new preparation.OccasionRequiredError("Occasion is required")
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
    expect(submittedWrites()).toEqual([]);
    expect(scheduled.tasks).toHaveLength(0);
  });

  it("a submit that fails before it is pending schedules no check", async () => {
    preparation.prepareSubmission.mockRejectedValueOnce(new Error("db down"));
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await POST(submitRequest(SUBMIT_BODY));

    expect(response.status).toBe(500);
    expect(submittedWrites()).toEqual([]);
    expect(scheduled.tasks).toHaveLength(0);
    expect(logged).toHaveBeenCalled();
  });

  it("refuses a draft that was already submitted", async () => {
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      status: ExpensesStatus.PENDING,
      userId: "submitter-1",
    });

    const response = await POST(
      submitRequest({ ...SUBMIT_BODY, expenseId: "expense-1" })
    );

    expect(response.status).toBe(409);
    expect(preparation.prepareSubmission).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
    expect(scheduled.tasks).toHaveLength(0);
  });

  it("creates submitted expense rows through the admin client with submitter permissions", async () => {
    const response = await POST(submitRequest(SUBMIT_BODY));

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
      submitRequest({ ...SUBMIT_BODY, expenseId: "expense-1" })
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
    // The submit decides from the merged payload, not the app's default slug.
    const [, , preparedPayload] =
      preparation.prepareSubmission.mock.calls[0] ?? [];
    expect(preparedPayload).toMatchObject({
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
      submitRequest({ ...SUBMIT_BODY, expenseId: "expense-1" })
    );

    expect(response.status).toBe(403);
    expect(adminDb.updateRow).not.toHaveBeenCalled();
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

    const response = await POST(submitRequest(SUBMIT_BODY));

    expect(response.status).toBe(404);
  });

  it("answers 500 with a message string, never the raw error", async () => {
    adminDb.createRow.mockRejectedValue(
      Object.assign(new Error("secret internals"), { code: 503 })
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(submitRequest(SUBMIT_BODY));

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

    const response = await POST(submitRequest(SUBMIT_BODY));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      missingFields: "phone",
    });
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  it("reads the occasion and event with the expense it prepares", async () => {
    const response = await POST(submitRequest(SUBMIT_BODY));

    expect(response.status).toBe(200);
    // The submit's read is the second getRow; without these columns a new
    // client that omits the occasion would lose the stored one.
    const [, , , select] = sessionDb.getRow.mock.calls[1] ?? [];
    for (const column of ["occasion", "event_id"]) {
      expect(select?.[0]).toContain(column);
    }
  });

  it("prepares the saved draft with the student's name", async () => {
    const response = await POST(
      submitRequest({ ...SUBMIT_BODY, occasion: "Board meeting" })
    );

    expect(response.status).toBe(200);
    expect(preparation.prepareSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ db: adminDb, storage }),
      expect.objectContaining({ $id: "expense-1", description: "Travel" }),
      expect.objectContaining({ occasion: "Board meeting", total: 100 }),
      "Ada Lovelace"
    );
  });

  it("treats a missing controller flag as false", async () => {
    // Drift Campus Oslo offers the controller switch, so a missing flag is
    // what decides here.
    await POST(submitRequest({ ...SUBMIT_BODY, department: "1" }));

    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "expense",
      expect.any(String),
      expect.objectContaining({
        submitter_is_controller: false,
        submitter_is_financial_manager: false,
      }),
      expect.anything()
    );
  });

  it("keeps a web draft's controller switch when an old app submits it", async () => {
    // Saved on the web with the switch on, on Ledelsen Oslo.
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      campus: "1",
      department: "2",
      expenseAttachments: [{ $id: "att-1", cost_type: "social", url: "f1" }],
      status: ExpensesStatus.DRAFT,
      submitter_is_controller: true,
      userId: "submitter-1",
    });

    // An old app: no cost_type_chosen and no controller flag.
    const response = await POST(
      submitRequest({
        ...SUBMIT_BODY,
        department: "2",
        expenseAttachments: [{ amount: 100, cost_type: "social", url: "f1" }],
        expenseId: "expense-1",
        submitter_is_financial_manager: false,
      })
    );

    expect(response.status).toBe(200);
    const [, , , select] = adminDb.getRow.mock.calls[0] ?? [];
    expect(select?.[0]).toContain("submitter_is_controller");
    // Stored on the expense, where the check reads it to route the chain to
    // the president, never the controller who submitted it.
    const saved = adminDb.updateRow.mock.calls.find(
      ([, table]) => table === "expense"
    )?.[3];
    expect(saved).toMatchObject({ submitter_is_controller: true });
    // The history note is written from the same merged payload.
    const [, , preparedPayload] =
      preparation.prepareSubmission.mock.calls[0] ?? [];
    expect(preparedPayload).toMatchObject({ submitter_is_controller: true });
  });

  it("drops a web draft's controller flag when the department changed", async () => {
    // Saved on the web with the switch on, on Ledelsen Oslo (department 2).
    adminDb.getRow.mockResolvedValue({
      $id: "expense-1",
      campus: "1",
      department: "2",
      expenseAttachments: [],
      status: ExpensesStatus.DRAFT,
      submitter_is_controller: true,
      userId: "submitter-1",
    });

    // An old app moves it to Drift Campus Oslo (department 1), which also
    // offers the controller switch, and sends no flag.
    const response = await POST(
      submitRequest({ ...SUBMIT_BODY, department: "1", expenseId: "expense-1" })
    );

    expect(response.status).toBe(200);
    const saved = adminDb.updateRow.mock.calls.find(
      ([, table]) => table === "expense"
    )?.[3];
    expect(saved).toMatchObject({ submitter_is_controller: false });
  });

  it("stores the financial-manager flag on Ledelsen Oslo as false", async () => {
    await POST(
      submitRequest({
        ...SUBMIT_BODY,
        department: "2",
        submitter_is_financial_manager: true,
      })
    );

    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "expense",
      expect.any(String),
      expect.objectContaining({
        submitter_is_controller: false,
        submitter_is_financial_manager: false,
      }),
      expect.anything()
    );
  });

  it("stores the controller flag on an ordinary Oslo department as false", async () => {
    await POST(
      submitRequest({
        ...SUBMIT_BODY,
        department: "dept-1",
        submitter_is_controller: true,
      })
    );

    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "expense",
      expect.any(String),
      expect.objectContaining({
        submitter_is_controller: false,
        submitter_is_financial_manager: false,
      }),
      expect.anything()
    );
  });

  it("stores a declared controller switch the department offers", async () => {
    await POST(
      submitRequest({
        ...SUBMIT_BODY,
        department: "1",
        submitter_is_controller: true,
      })
    );

    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "expense",
      expect.any(String),
      expect.objectContaining({ submitter_is_controller: true }),
      expect.anything()
    );
  });

  it("stores a switch the department does not offer as false", async () => {
    await POST(
      submitRequest({
        ...SUBMIT_BODY,
        campus: "2",
        submitter_is_controller: true,
        submitter_is_financial_manager: true,
      })
    );

    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "expense",
      expect.any(String),
      expect.objectContaining({
        submitter_is_controller: false,
        submitter_is_financial_manager: false,
      }),
      expect.anything()
    );
  });

  it("never returns account numbers to the student", async () => {
    sessionDb.getRow.mockReset();
    sessionDb.getRow.mockResolvedValueOnce(PROFILE).mockResolvedValue({
      ...PENDING_EXPENSE,
      expenseAttachments: [
        {
          $id: "att-1",
          account_number: 7310,
          account_source: "ai_freeform",
          amount: 100,
          cost_type: "social",
          project_confidence: 0.9,
          project_id: "p1",
          project_name: "Fadderuke 2026",
          project_source: "ai",
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
        project_confidence: null,
        project_id: null,
        project_name: null,
        project_source: null,
        tax_code: null,
        url: "file-1",
      },
    ]);
  });
});
