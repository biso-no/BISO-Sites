import {
  afterAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import type { ExpenseActionError } from "../action-result";

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
mock.module("server-only", () => ({}));
const getExpenseViewer = mock();
mock.module("@/lib/expense-viewer", () => ({ getExpenseViewer }));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));

const {
  changeExpenseApprover,
  decideExpenseStep,
  retryExpenseBooking,
  updateExpenseBankAccount,
  updateExpenseReceipt,
} = await import("./actions");

const realFetch = globalThis.fetch;
const fetchMock = mock();
const apiBody = () =>
  JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
const apiUrl = () => fetchMock.mock.calls[0]?.[0] as string;

const viewer = (over: Record<string, unknown> = {}) => ({
  accountEmail: "fin@example.com",
  controllerCampusIds: [],
  emails: ["fin@example.com"],
  isCampusAdmin: false,
  isGlobalAdmin: false,
  managedCampusIds: [],
  name: "Fin Manager",
  userId: "approver-user",
  ...over,
});

const attachment = (id: string, amount: number) => ({
  $id: id,
  account_number: 7140,
  amount,
  cost_type: "food",
  cost_type_text: null,
  date: "2026-11-01T00:00:00.000Z",
  description: id,
  tax_code: 3,
});

const expense = () => ({
  $id: "ex1",
  bank_account: "12345678903",
  campus: "oslo",
  expenseAttachments: [
    attachment("a1", 200),
    attachment("a2", 50),
    attachment("stmt", 0),
  ],
  status: "pending",
  submitter_is_controller: false,
  submitter_is_financial_manager: false,
  total: 250,
  userId: "student",
});

const steps = [
  {
    $id: "s1",
    approver_email: "fin@example.com",
    approver_role: "finance",
    status: "pending",
    step: 1,
  },
];

let freshAttachments: { amount: number }[] = [];

beforeEach(() => {
  freshAttachments = [{ amount: 100.46 }, { amount: 70 }, { amount: 0 }];
  for (const fn of Object.values(db)) {
    fn.mockReset();
  }
  getExpenseViewer.mockReset();
  getExpenseViewer.mockResolvedValue(viewer());
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
  process.env.CRON_SECRET = "secret";
  db.getRow.mockResolvedValue(expense());
  db.updateRow.mockResolvedValue({});
  db.createRow.mockResolvedValue({});
  db.listRows.mockImplementation((_d: string, table: string) => {
    if (table === "expense_approvals") {
      return Promise.resolve({ rows: steps });
    }
    if (table === "expense_attachments") {
      return Promise.resolve({ rows: freshAttachments });
    }
    return Promise.resolve({ rows: [] });
  });
});

describe("updateExpenseReceipt", () => {
  test("refuses when the viewer cannot edit", async () => {
    getExpenseViewer.mockResolvedValue(viewer({ emails: ["other@x.no"] }));
    const result = await updateExpenseReceipt({
      attachmentId: "a1",
      changes: { amount: 10 },
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "forbidden" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("refuses a receipt from another expense", async () => {
    const result = await updateExpenseReceipt({
      attachmentId: "elsewhere",
      changes: { amount: 10 },
      expenseId: "ex1",
    });
    expect(result).toHaveProperty("error");
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("refuses an edit on an approved expense", async () => {
    db.getRow.mockResolvedValue({ ...expense(), status: "approved" });
    const result = await updateExpenseReceipt({
      attachmentId: "a1",
      changes: { amount: 10 },
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "forbidden" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("an on-behalf actor records admin as source and actor", async () => {
    getExpenseViewer.mockResolvedValue(
      viewer({ emails: ["boss@example.com"], isGlobalAdmin: true })
    );
    const rowsByTable: Record<string, unknown[]> = {
      expense_approvals: steps,
      ledger_accounts: [
        { account_number: 7300, active: true, name: "x", tax_code: 1 },
      ],
    };
    db.listRows.mockImplementation((_d: string, table: string) =>
      Promise.resolve({ rows: rowsByTable[table] ?? [] })
    );
    const result = await updateExpenseReceipt({
      attachmentId: "a1",
      changes: { accountNumber: 7300 },
      expenseId: "ex1",
    });
    expect(result).toEqual({ data: { total: 250 } });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "a1",
      { account_number: 7300, account_source: "admin", tax_code: 1 }
    );
    expect(db.createRow.mock.calls[0]?.[3]).toMatchObject({
      actor_email: "boss@example.com",
      actor_kind: "admin",
      field: "account_number",
    });
  });

  test("recomputes the total after an amount change", async () => {
    const result = await updateExpenseReceipt({
      attachmentId: "a1",
      changes: { amount: 100.456 },
      expenseId: "ex1",
    });
    // Computed from the re-read rows, not the loaded copy.
    expect(result).toEqual({ data: { total: 170.46 } });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "a1",
      { amount: 100.46 }
    );
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "ex1", {
      total: 170.46,
    });
    const events = db.createRow.mock.calls.map(
      (call) => call[3] as Record<string, unknown>
    );
    expect(events.map((e) => e.field)).toEqual(["amount", "total"]);
    expect(events[0]).toMatchObject({
      action: "edited",
      actor_email: "fin@example.com",
      actor_kind: "approver",
      attachment_id: "a1",
    });
    expect(events[1]).toMatchObject({ after: "170.46", before: "250" });
  });

  test("a no-op change writes nothing", async () => {
    const result = await updateExpenseReceipt({
      attachmentId: "a1",
      changes: { description: "a1" },
      expenseId: "ex1",
    });
    expect(result).toEqual({ data: { total: 250 } });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });
});

describe("updateExpenseBankAccount", () => {
  const admin = () => viewer({ emails: [], isGlobalAdmin: true });

  test("refuses an approver who is not an actor", async () => {
    const result = await updateExpenseBankAccount({
      bankAccount: "98765432109",
      expenseId: "ex1",
    });
    expect(result).toHaveProperty("error");
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("rejects a number that is not 11 digits", async () => {
    getExpenseViewer.mockResolvedValue(admin());
    const result = await updateExpenseBankAccount({
      bankAccount: "1234.56.7",
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "invalid_bank_account" });
  });

  test("stores digits and logs masked values as admin", async () => {
    getExpenseViewer.mockResolvedValue(admin());
    const result = await updateExpenseBankAccount({
      bankAccount: "9876.54.32109",
      expenseId: "ex1",
    });
    expect(result).toEqual({ data: null });
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "ex1", {
      bank_account: "98765432109",
    });
    expect(db.createRow.mock.calls[0]?.[3]).toMatchObject({
      actor_kind: "admin",
      after: "•••• 2109",
      before: "•••• 8903",
      field: "bank_account",
    });
  });
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

const decidedOk = (decision: "approved" | "rejected") =>
  Response.json({
    result: {
      decision,
      expenseId: "ex1",
      finalized: false,
      ok: true,
      reimbursementNumber: "10042",
    },
  });

describe("decideExpenseStep", () => {
  test("decideExpenseStep refuses a step that is not current", async () => {
    const result = await decideExpenseStep({
      approvalId: "s-other",
      decision: "approved",
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "not_current_step" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses a viewer who cannot decide", async () => {
    getExpenseViewer.mockResolvedValue(viewer({ emails: ["other@x.no"] }));
    const result = await decideExpenseStep({
      approvalId: "s1",
      decision: "approved",
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sends approver for the step's approver", async () => {
    fetchMock.mockResolvedValue(decidedOk("approved"));
    const result = await decideExpenseStep({
      approvalId: "s1",
      decision: "approved",
      expenseId: "ex1",
    });
    expect(result).toEqual({ data: { decision: "approved" } });
    expect(apiUrl()).toBe("https://api.example.test/api/expenses/admin/decide");
    expect(apiBody()).toEqual({
      actor: {
        email: "fin@example.com",
        kind: "approver",
        name: "Fin Manager",
      },
      approvalId: "s1",
      decision: "approved",
      onBehalf: false,
    });
  });

  test("sends on-behalf for a global admin", async () => {
    getExpenseViewer.mockResolvedValue(
      viewer({
        emails: ["boss@example.com"],
        isGlobalAdmin: true,
        name: "Boss",
      })
    );
    fetchMock.mockResolvedValue(decidedOk("approved"));
    await decideExpenseStep({
      approvalId: "s1",
      decision: "approved",
      expenseId: "ex1",
    });
    expect(apiBody()).toMatchObject({
      actor: { email: "boss@example.com", kind: "admin", name: "Boss" },
      onBehalf: true,
    });
  });

  test("reject needs a reason", async () => {
    for (const reason of [undefined, "   "]) {
      const result = await decideExpenseStep({
        approvalId: "s1",
        decision: "rejected",
        expenseId: "ex1",
        reason,
      });
      expect(result).toEqual({ error: "reason_required" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sends the trimmed reason on a rejection", async () => {
    fetchMock.mockResolvedValue(decidedOk("rejected"));
    await decideExpenseStep({
      approvalId: "s1",
      decision: "rejected",
      expenseId: "ex1",
      reason: "  Not covered  ",
    });
    expect(apiBody()).toMatchObject({
      decision: "rejected",
      reason: "Not covered",
    });
  });

  test("reports already decided when the stored outcome differs", async () => {
    fetchMock.mockResolvedValue(decidedOk("rejected"));
    const result = await decideExpenseStep({
      approvalId: "s1",
      decision: "approved",
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "already_decided" });
  });

  test("maps a refused step from the api", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          code: "not_current_step",
          error: "This step is not waiting for a decision.",
        },
        { status: 400 }
      )
    );
    const result = await decideExpenseStep({
      approvalId: "s1",
      decision: "approved",
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "not_current_step" });
  });
});

describe("changeExpenseApprover", () => {
  const globalAdmin = () =>
    getExpenseViewer.mockResolvedValue(
      viewer({ emails: ["boss@example.com"], isGlobalAdmin: true })
    );

  test("changeExpenseApprover refuses a non-biso address", async () => {
    globalAdmin();
    const result = await changeExpenseApprover({
      approvalId: "s1",
      email: "someone@gmail.com",
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "invalid_email" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses a viewer who cannot change the approver", async () => {
    const result = await changeExpenseApprover({
      approvalId: "s1",
      email: "new@biso.no",
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses a step that is not current", async () => {
    globalAdmin();
    const result = await changeExpenseApprover({
      approvalId: "s-other",
      email: "new@biso.no",
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "not_current_step" });
  });

  test("accepts a biso address in any case and reports notified", async () => {
    globalAdmin();
    fetchMock.mockResolvedValue(
      Response.json({
        result: { directorySaved: false, notified: false, ok: true },
      })
    );
    const result = await changeExpenseApprover({
      approvalId: "s1",
      email: " New@BISO.no ",
      expenseId: "ex1",
    });
    expect(result).toEqual({
      data: { directorySaved: false, notified: false },
    });
    expect(apiUrl()).toBe(
      "https://api.example.test/api/expenses/admin/change-approver"
    );
    expect(apiBody()).toMatchObject({ approvalId: "s1", email: "new@biso.no" });
  });
});

describe("retryExpenseBooking", () => {
  const failedExpense = () =>
    db.getRow.mockResolvedValue({ ...expense(), status: "failed" });
  const globalAdmin = () =>
    getExpenseViewer.mockResolvedValue(
      viewer({ emails: ["boss@example.com"], isGlobalAdmin: true })
    );

  test("refuses a viewer who cannot retry", async () => {
    failedExpense();
    const result = await retryExpenseBooking({ expenseId: "ex1" });
    expect(result).toEqual({ error: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("calls the retry route and returns the status", async () => {
    failedExpense();
    globalAdmin();
    fetchMock.mockResolvedValue(
      Response.json({ result: { ok: true, status: "success" } })
    );
    const result = await retryExpenseBooking({ expenseId: "ex1" });
    expect(result).toEqual({ data: { status: "success" } });
    expect(apiUrl()).toBe(
      "https://api.example.test/api/expenses/admin/retry-booking"
    );
    expect(apiBody()).toMatchObject({
      actor: { kind: "admin" },
      expenseId: "ex1",
    });
  });

  test("maps the api refusals by code, not by message", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(
      () => undefined
    );
    try {
      failedExpense();
      globalAdmin();
      const cases: [string | undefined, ExpenseActionError][] = [
        ["already_booked", "already_booked"],
        ["not_failed", "not_failed"],
        ["posting_disabled", "posting_disabled"],
        ["retry_in_progress", "retry_in_progress"],
        ["status_write_failed", "status_write_failed"],
        ["something_new", "api_failed"],
        [undefined, "api_failed"],
      ];
      for (const [code, expected] of cases) {
        fetchMock.mockReset();
        fetchMock.mockResolvedValue(
          Response.json(
            { error: "Only failed bookings can be retried.", code },
            { status: 400 }
          )
        );
        expect(await retryExpenseBooking({ expenseId: "ex1" })).toEqual({
          error: expected,
        });
      }
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("keeps Finago's message for a failed booking", async () => {
    failedExpense();
    globalAdmin();
    fetchMock.mockResolvedValue(
      Response.json(
        { code: "booking_failed", error: "Finago down" },
        { status: 400 }
      )
    );
    expect(await retryExpenseBooking({ expenseId: "ex1" })).toEqual({
      error: "booking_failed",
      message: "Finago down",
    });
  });
});

describe("changeExpenseApprover api codes", () => {
  test("maps self_approver", async () => {
    getExpenseViewer.mockResolvedValue(
      viewer({ emails: ["boss@example.com"], isGlobalAdmin: true })
    );
    fetchMock.mockResolvedValue(
      Response.json(
        { code: "self_approver", error: "The submitter cannot approve" },
        { status: 400 }
      )
    );
    expect(
      await changeExpenseApprover({
        approvalId: "s1",
        email: "student@biso.no",
        expenseId: "ex1",
      })
    ).toEqual({ error: "self_approver" });
  });
});
