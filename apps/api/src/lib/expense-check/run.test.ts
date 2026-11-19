import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  updateRow: vi.fn(),
}));
const messaging = vi.hoisted(() => ({ createEmail: vi.fn() }));
const storage = vi.hoisted(() => ({ createFile: vi.fn() }));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db, messaging, storage })),
}));

const flags = vi.hoisted(() => ({
  states: {
    expenses_ledger_posting: true,
    expenses_module: true,
    expenses_ocr: true,
  } as Record<string, boolean>,
}));
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  getFeatureFlagStates: vi.fn(async () => ({ ...flags.states })),
  isFeatureEnabled: vi.fn(async (key: string) => flags.states[key] ?? false),
}));

const fixedSteps = vi.hoisted(() => ({
  enrichUnsettled: vi.fn(),
  flagCheckIncomplete: vi.fn(),
}));
vi.mock("../expense-submission", () => fixedSteps);

const approval = vi.hoisted(() => {
  class ApprovalChainFailedError extends Error {}
  return { ApprovalChainFailedError, createApprovalChain: vi.fn() };
});
vi.mock("../expense-approval", () => approval);

const examples = vi.hoisted(() => ({ syncExamplesForExpense: vi.fn() }));
vi.mock("@repo/shared/utils/expense-examples", () => examples);

vi.mock("../pdf/expense-pdf", () => ({
  generateExpensePdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));
vi.mock("@repo/api/file", () => ({
  InputFile: { fromBuffer: vi.fn(() => ({ file: "pdf" })) },
}));

import { runExpenseCheck } from "./run";

const NOW = Date.parse("2026-11-19T12:00:00.000Z");

const EXPENSE = {
  $id: "expense-1",
  $sequence: 42,
  campus: "1",
  campusRel: { name: "Oslo" },
  check_state: "queued",
  department: "dept-1",
  departmentRel: { Name: "Marketing" },
  description: "Travel",
  expenseAttachments: [
    { amount: 100, date: "2026-11-01", description: "Taxi", url: "file-1" },
  ],
  status: "pending",
  submitter_is_controller: true,
  submitter_is_financial_manager: false,
  total: 100,
  user: {
    $id: "user-1",
    address: "Street 1",
    bank_account: "1234.56.78901",
    city: "Oslo",
    email: "ada@example.com",
    name: "Ada Lovelace",
    phone: "12345678",
    zip: "0001",
  },
  userId: "user-1",
};

/** The claim column as the database keeps it: an atomic counter. */
let claims = 0;

function expenseWrites() {
  return db.updateRow.mock.calls
    .filter(([, table]) => table === "expense")
    .map((call) => call[3] as Record<string, unknown>);
}

function finalState() {
  return expenseWrites().find((data) => "check_finished_at" in data);
}

function callOrder(mock: { mock: { invocationCallOrder: number[] } }) {
  return mock.mock.invocationCallOrder[0] ?? 0;
}

beforeEach(() => {
  vi.clearAllMocks();
  claims = 0;
  flags.states.expenses_ledger_posting = true;
  flags.states.expenses_module = true;
  flags.states.expenses_ocr = true;
  db.incrementRowColumn.mockImplementation(() => {
    // Each caller sees the value after its own increment, as Appwrite does.
    claims += 1;
    return Promise.resolve({
      $id: "expense-1",
      check_claim: claims,
      check_state: "queued",
    });
  });
  db.getRow.mockResolvedValue(EXPENSE);
  db.updateRow.mockResolvedValue({});
  fixedSteps.enrichUnsettled.mockResolvedValue(undefined);
  fixedSteps.flagCheckIncomplete.mockResolvedValue(undefined);
  approval.createApprovalChain.mockResolvedValue({
    notified: true,
    stepsCreated: 2,
  });
  examples.syncExamplesForExpense.mockResolvedValue(undefined);
  messaging.createEmail.mockResolvedValue({});
  storage.createFile.mockResolvedValue({ $id: "pdf-1" });
  vi.stubEnv("INVOICE_USER_ID", "invoice-user");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runExpenseCheck", () => {
  it("claims the expense before any work and marks it running", async () => {
    const outcome = await runExpenseCheck("expense-1", { now: () => NOW });

    expect(db.incrementRowColumn).toHaveBeenCalledWith({
      column: "check_claim",
      databaseId: "app",
      rowId: "expense-1",
      tableId: "expense",
      value: 1,
    });
    expect(expenseWrites()[0]).toEqual({
      check_started_at: "2026-11-19T12:00:00.000Z",
      check_state: "running",
    });
    // No agent yet: the fixed steps do the work, flagged for the approver.
    expect(outcome).toBe("fallback");
  });

  it("a double submit runs one check and notifies once", async () => {
    const outcomes = await Promise.all([
      runExpenseCheck("expense-1"),
      runExpenseCheck("expense-1"),
    ]);

    expect(outcomes.filter((outcome) => outcome === "skipped")).toHaveLength(1);
    expect(fixedSteps.enrichUnsettled).toHaveBeenCalledTimes(1);
    expect(approval.createApprovalChain).toHaveBeenCalledTimes(1);
    expect(examples.syncExamplesForExpense).toHaveBeenCalledTimes(1);

    // The same with accounting's email instead of the chain.
    vi.clearAllMocks();
    claims = 0;
    flags.states.expenses_ledger_posting = false;
    await Promise.all([
      runExpenseCheck("expense-1"),
      runExpenseCheck("expense-1"),
    ]);
    expect(
      messaging.createEmail.mock.calls.filter(([email]) =>
        email.users.includes("invoice-user")
      )
    ).toHaveLength(1);
  });

  it("a lost claim does nothing else", async () => {
    claims = 1;

    expect(await runExpenseCheck("expense-1")).toBe("skipped");
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(fixedSteps.enrichUnsettled).not.toHaveBeenCalled();
    expect(approval.createApprovalChain).not.toHaveBeenCalled();
    expect(messaging.createEmail).not.toHaveBeenCalled();
  });

  it("skips an expense whose check is not waiting", async () => {
    for (const state of [null, "done", "fallback"]) {
      claims = 0;
      db.incrementRowColumn.mockResolvedValueOnce({
        $id: "expense-1",
        check_claim: 1,
        check_state: state,
      });
      expect(await runExpenseCheck("expense-1")).toBe("skipped");
    }
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(approval.createApprovalChain).not.toHaveBeenCalled();
  });

  it("a failed check falls back and still notifies", async () => {
    const agent = vi.fn(() => Promise.reject(new Error("model down")));
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const outcome = await runExpenseCheck("expense-1", {
      agent,
      now: () => NOW,
    });

    logged.mockRestore();
    expect(outcome).toBe("fallback");
    expect(agent).toHaveBeenCalledWith("expense-1");
    expect(fixedSteps.enrichUnsettled).toHaveBeenCalledWith(
      expect.objectContaining({ db }),
      "expense-1",
      expect.objectContaining({ extraHints: [{ code: "ai_check_incomplete" }] })
    );
    expect(approval.createApprovalChain).toHaveBeenCalledTimes(1);
    expect(finalState()).toEqual({
      check_finished_at: "2026-11-19T12:00:00.000Z",
      check_state: "fallback",
    });
  });

  it("notifies with the flag when the fixed steps fail too", async () => {
    fixedSteps.enrichUnsettled.mockRejectedValue(new Error("db down"));
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const outcome = await runExpenseCheck("expense-1", {
      agent: async () => true,
    });

    logged.mockRestore();
    expect(outcome).toBe("fallback");
    expect(fixedSteps.flagCheckIncomplete).toHaveBeenCalledWith(
      db,
      "expense-1"
    );
    expect(approval.createApprovalChain).toHaveBeenCalledTimes(1);
    expect(finalState()).toMatchObject({ check_state: "fallback" });
  });

  it("an answered check is done and adds no flag", async () => {
    const outcome = await runExpenseCheck("expense-1", {
      agent: async () => true,
    });

    expect(outcome).toBe("done");
    expect(fixedSteps.enrichUnsettled).toHaveBeenCalledWith(
      expect.anything(),
      "expense-1",
      expect.objectContaining({ extraHints: [] })
    );
    expect(finalState()).toMatchObject({ check_state: "done" });
  });

  it("asks no agent while the AI is off, and is done", async () => {
    flags.states.expenses_ocr = false;
    const agent = vi.fn(async () => false);

    expect(await runExpenseCheck("expense-1", { agent })).toBe("done");
    expect(agent).not.toHaveBeenCalled();
    expect(fixedSteps.enrichUnsettled).toHaveBeenCalledWith(
      expect.anything(),
      "expense-1",
      expect.objectContaining({ extraHints: [] })
    );
  });

  it("builds the approval chain from the expense as stored, after the check", async () => {
    await runExpenseCheck("expense-1", { agent: async () => true });

    expect(approval.createApprovalChain).toHaveBeenCalledWith(
      {
        campusId: "1",
        campusLabel: "Oslo",
        currency: "NOK",
        departmentId: "dept-1",
        departmentLabel: "Marketing",
        departmentName: "Marketing",
        description: "Travel",
        expenseId: "expense-1",
        reimbursementNumber: "10042",
        submitterIsController: true,
        submitterIsFinancialManager: false,
        submitterName: "Ada Lovelace",
        submitterUserId: "user-1",
        total: 100,
      },
      { keepPendingOnFailure: true, recordIssue: true }
    );
    // Approvers hear of it only once the check has finished.
    expect(callOrder(fixedSteps.enrichUnsettled)).toBeLessThan(
      callOrder(approval.createApprovalChain)
    );
    // The state is written last, so a run that dies before notifying is
    // still running and the backstop finishes it.
    const stateWrite = db.updateRow.mock.invocationCallOrder.at(-1) ?? 0;
    expect(stateWrite).toBeGreaterThan(callOrder(approval.createApprovalChain));
    expect(finalState()).toMatchObject({ check_state: "done" });
    // The Stage 2 example sync now follows the notification.
    expect(examples.syncExamplesForExpense).toHaveBeenCalledWith(
      db,
      "expense-1",
      { confirmed: false }
    );
    expect(callOrder(examples.syncExamplesForExpense)).toBeGreaterThan(
      callOrder(approval.createApprovalChain)
    );
  });

  it("finishes the check when the background chain fails", async () => {
    approval.createApprovalChain.mockRejectedValue(
      new approval.ApprovalChainFailedError("mail down")
    );
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const outcome = await runExpenseCheck("expense-1", {
      agent: async () => true,
    });

    logged.mockRestore();
    // The issue is IT's to act on; the expense stays pending.
    expect(outcome).toBe("done");
    expect(finalState()).toMatchObject({ check_state: "done" });
    expect(
      expenseWrites().some((data) => data.status && data.status !== "pending")
    ).toBe(false);
    expect(examples.syncExamplesForExpense).toHaveBeenCalledTimes(1);
  });

  it("treats a chain another run created as notified", async () => {
    approval.createApprovalChain.mockRejectedValue(
      Object.assign(new Error("Row already exists"), { code: 409 })
    );

    expect(
      await runExpenseCheck("expense-1", { agent: async () => true })
    ).toBe("done");
    expect(finalState()).toMatchObject({ check_state: "done" });
  });

  it("leaves the check running when the chain fails with nobody told", async () => {
    approval.createApprovalChain.mockRejectedValue(new Error("db down"));

    await expect(
      runExpenseCheck("expense-1", { agent: async () => true })
    ).rejects.toThrow("db down");
    expect(finalState()).toBeUndefined();
    expect(examples.syncExamplesForExpense).not.toHaveBeenCalled();
  });

  it("the email goes out after the check", async () => {
    flags.states.expenses_ledger_posting = false;

    await runExpenseCheck("expense-1", { agent: async () => true });

    expect(approval.createApprovalChain).not.toHaveBeenCalled();
    expect(messaging.createEmail).toHaveBeenCalledWith(
      expect.objectContaining({ html: true, users: ["user-1"] })
    );
    expect(messaging.createEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: ["expenses:pdf-1", "expenses:file-1"],
        html: true,
        subject: "User Ada Lovelace has submitted expense 10042",
        users: ["invoice-user"],
      })
    );
    expect(callOrder(fixedSteps.enrichUnsettled)).toBeLessThan(
      callOrder(messaging.createEmail)
    );
    expect(expenseWrites()).toContainEqual({ status: "pending" });
    expect(finalState()).toMatchObject({ check_state: "done" });
    expect(callOrder(examples.syncExamplesForExpense)).toBeGreaterThan(
      callOrder(messaging.createEmail)
    );
  });

  it("an email that fails leaves the check running for the backstop", async () => {
    flags.states.expenses_ledger_posting = false;
    vi.stubEnv("INVOICE_USER_ID", "");

    await expect(
      runExpenseCheck("expense-1", { agent: async () => true })
    ).rejects.toThrow("INVOICE_USER_ID");
    expect(storage.createFile).not.toHaveBeenCalled();
    expect(messaging.createEmail).not.toHaveBeenCalled();
    expect(finalState()).toBeUndefined();
    expect(examples.syncExamplesForExpense).not.toHaveBeenCalled();
  });
});
