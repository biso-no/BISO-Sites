import {
  afterAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { Query } from "@repo/api";
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
const isFeatureEnabled = mock(async (_key: string) => true);
mock.module("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled,
}));

const {
  applyProjectToAllReceipts,
  changeExpenseApprover,
  decideExpenseStep,
  rebuildExpenseChain,
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

beforeEach(() => {
  for (const fn of Object.values(db)) {
    fn.mockReset();
  }
  getExpenseViewer.mockReset();
  getExpenseViewer.mockResolvedValue(viewer());
  isFeatureEnabled.mockReset();
  isFeatureEnabled.mockResolvedValue(true);
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
    db.getRow.mockResolvedValueOnce(expense()).mockResolvedValueOnce({
      $id: "ex1",
      expenseAttachments: [
        { $id: "a1", amount: 100.46 },
        { $id: "a2", amount: 70 },
        { $id: "stmt", amount: 0 },
      ],
    });
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

  test("recomputes the total from every receipt of the expense", async () => {
    // Receipts without an expense_id column value still count: the total
    // is read through the expense's expenseAttachments relation.
    db.getRow.mockResolvedValueOnce(expense()).mockResolvedValueOnce({
      $id: "ex1",
      expenseAttachments: [
        { $id: "a1", amount: 100 },
        { $id: "a2", amount: 50.5 },
        { $id: "stmt", amount: 0 },
      ],
    });
    const result = await updateExpenseReceipt({
      attachmentId: "a1",
      changes: { amount: 100 },
      expenseId: "ex1",
    });
    expect(result).toEqual({ data: { total: 150.5 } });
    expect(db.getRow.mock.calls[1]).toEqual([
      "app",
      "expense",
      "ex1",
      [
        Query.select([
          "$id",
          "expenseAttachments.$id",
          "expenseAttachments.amount",
        ]),
      ],
    ]);
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "ex1", {
      total: 150.5,
    });
  });

  test("saving an edit updates the receipt's example", async () => {
    const legacy = {
      ...attachment("a1", 200),
      type_source: "legacy_app",
    };
    db.getRow.mockResolvedValue({
      ...expense(),
      department: "dept1",
      expenseAttachments: [legacy, attachment("a2", 50)],
    });
    db.listRows.mockImplementation((_d: string, table: string) => {
      if (table === "expense_approvals") {
        return Promise.resolve({ rows: steps });
      }
      if (table === "expense_cost_types") {
        return Promise.resolve({
          rows: [
            {
              account_number: 6800,
              active: true,
              label: "Office",
              slug: "office",
              tax_code: 1,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    const result = await updateExpenseReceipt({
      attachmentId: "a1",
      changes: { costType: "office" },
      expenseId: "ex1",
    });
    expect(result).toHaveProperty("data");
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "a1",
      expect.objectContaining({ type_source: "approver" })
    );
    const example = db.createRow.mock.calls.find(
      (call) => call[1] === "expense_type_examples"
    );
    expect(example?.[3]).toMatchObject({
      department_id: "dept1",
      final_cost_type: "office",
      type_source: "approver",
    });
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

describe("applyProjectToAllReceipts", () => {
  const withProjects = () =>
    db.listRows.mockImplementation((_d: string, table: string) => {
      if (table === "expense_approvals") {
        return Promise.resolve({ rows: steps });
      }
      if (table === "finago_projects") {
        return Promise.resolve({
          rows: [{ active: true, name: "Fadderullan 2026", project_id: "p1" }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

  test("apply to all sets every receipt with an amount", async () => {
    withProjects();
    db.getRow.mockResolvedValue({
      ...expense(),
      expenseAttachments: [
        attachment("a1", 200),
        { ...attachment("a2", 50), project_id: "p1" },
        attachment("stmt", 0),
      ],
    });
    const result = await applyProjectToAllReceipts("ex1", "p1");
    expect(result).toEqual({ data: { changed: 1, failed: 0 } });
    const updates = db.updateRow.mock.calls.filter(
      (call) => call[1] === "expense_attachments"
    );
    // a2 already has it and the statement is skipped.
    expect(updates.map((call) => call[2])).toEqual(["a1"]);
    expect(updates[0]?.[3]).toMatchObject({
      project_id: "p1",
      project_name: "Fadderullan 2026",
      project_source: "approver",
    });
    const events = db.createRow.mock.calls
      .map((call) => call[3] as Record<string, unknown>)
      .filter((e) => e.field === "project");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "edited",
      attachment_id: "a1",
    });
  });

  test("a failure part-way leaves events for exactly the rows written", async () => {
    withProjects();
    db.getRow.mockResolvedValue(expense());
    db.updateRow
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("boom"));
    const spy = spyOn(console, "error").mockImplementation(() => undefined);
    const result = await applyProjectToAllReceipts("ex1", "p1");
    spy.mockRestore();
    expect(result).toEqual({ data: { changed: 1, failed: 1 } });
    const events = db.createRow.mock.calls
      .map((call) => call[3] as Record<string, unknown>)
      .filter((e) => e.field === "project");
    expect(events.map((e) => e.attachment_id)).toEqual(["a1"]);
  });

  test("refuses when the expense stopped being pending", async () => {
    withProjects();
    db.getRow
      .mockResolvedValueOnce(expense())
      .mockResolvedValueOnce({ $id: "ex1", status: "approved" });
    expect(await applyProjectToAllReceipts("ex1", "p1")).toEqual({
      error: "not_pending",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("booked receipts are not changed", async () => {
    withProjects();
    db.getRow.mockResolvedValue({
      ...expense(),
      expenseAttachments: [
        { ...attachment("a1", 200), booked_date: "2026-11-02T00:00:00.000Z" },
        attachment("a2", 50),
      ],
    });
    const result = await applyProjectToAllReceipts("ex1", "p1");
    expect(result).toEqual({ data: { changed: 1, failed: 0 } });
    const updates = db.updateRow.mock.calls.map((call) => call[2]);
    expect(updates).toEqual(["a2"]);
  });

  test("refuses a viewer who cannot edit", async () => {
    withProjects();
    getExpenseViewer.mockResolvedValue(viewer({ emails: ["other@x.no"] }));
    expect(await applyProjectToAllReceipts("ex1", "p1")).toEqual({
      error: "forbidden",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("an unknown project changes nothing", async () => {
    withProjects();
    expect(await applyProjectToAllReceipts("ex1", "zzz")).toEqual({
      error: "invalid_project",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});

describe("updateExpenseBankAccount", () => {
  const admin = () => viewer({ emails: [], isGlobalAdmin: true });

  test("refuses an approver who is not an actor", async () => {
    const result = await updateExpenseBankAccount({
      bankAccount: "98765432103",
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

  test("rejects 11 digits with a wrong check digit", async () => {
    getExpenseViewer.mockResolvedValue(admin());
    const result = await updateExpenseBankAccount({
      bankAccount: "1234.56.78904",
      expenseId: "ex1",
    });
    expect(result).toEqual({ error: "invalid_bank_account" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("stores digits and logs masked values as admin", async () => {
    getExpenseViewer.mockResolvedValue(admin());
    const result = await updateExpenseBankAccount({
      bankAccount: "9876.54.32103",
      expenseId: "ex1",
    });
    expect(result).toEqual({ data: null });
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "ex1", {
      bank_account: "98765432103",
    });
    expect(db.createRow.mock.calls[0]?.[3]).toMatchObject({
      actor_kind: "admin",
      after: "•••• 2103",
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

  test("an empty viewer name falls back to the email", async () => {
    getExpenseViewer.mockResolvedValue(viewer({ name: "  " }));
    fetchMock.mockResolvedValue(decidedOk("approved"));
    await decideExpenseStep({
      approvalId: "s1",
      decision: "approved",
      expenseId: "ex1",
    });
    expect(apiBody().actor.name).toBe("fin@example.com");
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

  test("passes directorySkipped through for a general-manager step", async () => {
    globalAdmin();
    fetchMock.mockResolvedValue(
      Response.json({
        result: {
          directorySaved: false,
          directorySkipped: true,
          notified: true,
          ok: true,
        },
      })
    );
    const result = await changeExpenseApprover({
      approvalId: "s1",
      email: "new@biso.no",
      expenseId: "ex1",
    });
    expect(result).toEqual({
      data: { directorySaved: false, directorySkipped: true, notified: true },
    });
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
      data: {
        directorySaved: false,
        directorySkipped: false,
        notified: false,
      },
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

  test("a booking it could not record carries its transaction id", async () => {
    failedExpense();
    globalAdmin();
    fetchMock.mockResolvedValue(
      Response.json(
        {
          code: "booking_unrecorded",
          error:
            "Finago has the booking (tx-9) but it could not be saved here.",
          transactionId: "tx-9",
        },
        { status: 400 }
      )
    );
    expect(await retryExpenseBooking({ expenseId: "ex1" })).toEqual({
      error: "booking_unrecorded",
      transactionId: "tx-9",
    });
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
  test("maps same_approver", async () => {
    getExpenseViewer.mockResolvedValue(
      viewer({ emails: ["boss@example.com"], isGlobalAdmin: true })
    );
    fetchMock.mockResolvedValue(
      Response.json(
        { code: "same_approver", error: "Already the approver" },
        { status: 400 }
      )
    );
    expect(
      await changeExpenseApprover({
        approvalId: "s1",
        email: "old@biso.no",
        expenseId: "ex1",
      })
    ).toEqual({ error: "same_approver" });
  });

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

describe("rebuildExpenseChain", () => {
  const NO_APPROVER_ISSUE = {
    reason:
      "No approver could be resolved. The reimbursement is pending with no approval step.",
  };
  // A pending expense with no steps, and the given approval issues.
  const emptyChain = (issues: object[] = [NO_APPROVER_ISSUE]) => {
    db.getRow.mockResolvedValue(expense());
    db.listRows.mockImplementation((_d: string, table: string) =>
      Promise.resolve({
        rows: table === "expense_approval_issues" ? issues : [],
      })
    );
  };
  const globalAdmin = () =>
    getExpenseViewer.mockResolvedValue(
      viewer({ emails: ["boss@example.com"], isGlobalAdmin: true })
    );

  test("only global admins can rebuild a chain", async () => {
    emptyChain();
    getExpenseViewer.mockResolvedValue(viewer({ isCampusAdmin: true }));
    expect(await rebuildExpenseChain("ex1")).toEqual({ error: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses an expense that went to accounting by email", async () => {
    emptyChain([]);
    globalAdmin();
    expect(await rebuildExpenseChain("ex1")).toEqual({ error: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses while direct booking is off", async () => {
    emptyChain();
    globalAdmin();
    isFeatureEnabled.mockResolvedValue(false);
    expect(await rebuildExpenseChain("ex1")).toEqual({ error: "forbidden" });
    expect(isFeatureEnabled).toHaveBeenCalledWith("expenses_ledger_posting");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("maps the api's not_rebuildable refusal", async () => {
    emptyChain();
    globalAdmin();
    fetchMock.mockResolvedValue(
      Response.json({ code: "not_rebuildable", error: "no" }, { status: 400 })
    );
    expect(await rebuildExpenseChain("ex1")).toEqual({
      error: "not_rebuildable",
    });
  });

  test("calls the rebuild route for a global admin", async () => {
    emptyChain();
    globalAdmin();
    fetchMock.mockResolvedValue(
      Response.json({ result: { ok: true, stepsCreated: 2 } })
    );
    expect(await rebuildExpenseChain("ex1")).toEqual({
      data: { stepsCreated: 2 },
    });
    expect(apiUrl()).toBe(
      "https://api.example.test/api/expenses/admin/rebuild-chain"
    );
    expect(apiBody()).toMatchObject({
      actor: { kind: "admin" },
      expenseId: "ex1",
    });
  });
});
