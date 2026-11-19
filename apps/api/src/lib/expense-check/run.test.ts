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
  getFeatureFlagStates: vi.fn(),
}));
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  getFeatureFlagStates: flags.getFeatureFlagStates,
  isFeatureEnabled: vi.fn(async (key: string) => flags.states[key] ?? false),
}));

const fixedSteps = vi.hoisted(() => ({
  enrichUnsettled: vi.fn(),
  flagCheckIncomplete: vi.fn(),
}));
vi.mock("../expense-submission", () => fixedSteps);

const approval = vi.hoisted(() => {
  class ApprovalChainFailedError extends Error {}
  return { ApprovalChainFailedError, ensureApprovalChain: vi.fn() };
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
const FINISHED_AT = "2026-11-19T11:00:00.000Z";
const INCOMPLETE = { code: "ai_check_incomplete" };

const EXPENSE = {
  $id: "expense-1",
  $sequence: 42,
  campus: "1",
  campusRel: { name: "Oslo" },
  check_claim: 1,
  check_finished_at: null as string | null,
  check_state: "queued" as string | null,
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

/** The expense the run reads, with these claim and state columns. */
function stored(over: Partial<typeof EXPENSE> = {}) {
  db.getRow.mockResolvedValue({ ...EXPENSE, ...over });
}

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

function emailsTo(user: string) {
  return messaging.createEmail.mock.calls.filter(([email]) =>
    email.users.includes(user)
  );
}

function silenceErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  claims = 0;
  flags.states.expenses_ledger_posting = true;
  flags.states.expenses_module = true;
  flags.states.expenses_ocr = true;
  flags.getFeatureFlagStates.mockImplementation(async () => ({
    ...flags.states,
  }));
  db.incrementRowColumn.mockImplementation(() => {
    // Each caller sees the value after its own increment, as Appwrite does.
    claims += 1;
    return Promise.resolve({ $id: "expense-1", check_claim: claims });
  });
  stored();
  db.updateRow.mockResolvedValue({});
  fixedSteps.enrichUnsettled.mockResolvedValue(undefined);
  fixedSteps.flagCheckIncomplete.mockResolvedValue(undefined);
  approval.ensureApprovalChain.mockResolvedValue(undefined);
  examples.syncExamplesForExpense.mockResolvedValue(undefined);
  messaging.createEmail.mockResolvedValue({});
  storage.createFile.mockResolvedValue({ $id: "pdf-1" });
  vi.stubEnv("INVOICE_USER_ID", "invoice-user");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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
    expect(approval.ensureApprovalChain).toHaveBeenCalledTimes(1);
    expect(examples.syncExamplesForExpense).toHaveBeenCalledTimes(1);

    // The same with accounting's email instead of the chain.
    vi.clearAllMocks();
    claims = 0;
    flags.states.expenses_ledger_posting = false;
    await Promise.all([
      runExpenseCheck("expense-1"),
      runExpenseCheck("expense-1"),
    ]);
    expect(emailsTo("invoice-user")).toHaveLength(1);
  });

  it("a lost claim does nothing else", async () => {
    claims = 1;

    expect(await runExpenseCheck("expense-1")).toBe("skipped");
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(fixedSteps.enrichUnsettled).not.toHaveBeenCalled();
    expect(approval.ensureApprovalChain).not.toHaveBeenCalled();
    expect(messaging.createEmail).not.toHaveBeenCalled();
  });

  it("skips an expense whose check is not waiting", async () => {
    for (const state of [null, "done", "fallback"]) {
      claims = 0;
      stored({ check_state: state });
      expect(await runExpenseCheck("expense-1")).toBe("skipped");
    }
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(approval.ensureApprovalChain).not.toHaveBeenCalled();
  });

  it("uses a caller's claim as it is", async () => {
    stored({ check_claim: 3, check_state: "running" });

    expect(
      await runExpenseCheck("expense-1", { agent: async () => true, claim: 3 })
    ).toBe("done");
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
    expect(approval.ensureApprovalChain).toHaveBeenCalledTimes(1);
  });

  it("skips a caller's claim that somebody claimed after", async () => {
    stored({ check_claim: 4, check_state: "running" });

    expect(await runExpenseCheck("expense-1", { claim: 3 })).toBe("skipped");
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(approval.ensureApprovalChain).not.toHaveBeenCalled();
  });

  it("a failed check falls back and still notifies", async () => {
    const agent = vi.fn(() => Promise.reject(new Error("model down")));
    silenceErrors();

    const outcome = await runExpenseCheck("expense-1", {
      agent,
      now: () => NOW,
    });

    expect(outcome).toBe("fallback");
    expect(agent).toHaveBeenCalledWith("expense-1");
    expect(fixedSteps.enrichUnsettled).toHaveBeenCalledWith(
      expect.objectContaining({ db }),
      "expense-1",
      expect.objectContaining({ aiEnabled: true, extraHints: [INCOMPLETE] })
    );
    expect(approval.ensureApprovalChain).toHaveBeenCalledTimes(1);
    expect(finalState()).toEqual({
      check_finished_at: "2026-11-19T12:00:00.000Z",
      check_state: "fallback",
    });
  });

  it("decides without the AI when the fixed steps fail, then notifies", async () => {
    fixedSteps.enrichUnsettled.mockRejectedValueOnce(new Error("model down"));
    silenceErrors();

    const outcome = await runExpenseCheck("expense-1", {
      agent: async () => true,
    });

    expect(outcome).toBe("fallback");
    // The defaults and their hints, with no model call.
    expect(fixedSteps.enrichUnsettled).toHaveBeenLastCalledWith(
      expect.anything(),
      "expense-1",
      expect.objectContaining({ aiEnabled: false, extraHints: [INCOMPLETE] })
    );
    expect(fixedSteps.flagCheckIncomplete).not.toHaveBeenCalled();
    expect(callOrder(approval.ensureApprovalChain)).toBeGreaterThan(
      fixedSteps.enrichUnsettled.mock.invocationCallOrder[1] ?? 0
    );
    expect(finalState()).toMatchObject({ check_state: "fallback" });
  });

  it("only flags the check when deciding without the AI fails too", async () => {
    fixedSteps.enrichUnsettled.mockRejectedValue(new Error("db down"));
    silenceErrors();

    const outcome = await runExpenseCheck("expense-1", {
      agent: async () => true,
    });

    expect(outcome).toBe("fallback");
    expect(fixedSteps.flagCheckIncomplete).toHaveBeenCalledWith(
      db,
      "expense-1"
    );
    expect(approval.ensureApprovalChain).toHaveBeenCalledTimes(1);
  });

  it("an answered check is done and adds no flag", async () => {
    const outcome = await runExpenseCheck("expense-1", {
      agent: async () => true,
    });

    expect(outcome).toBe("done");
    expect(fixedSteps.enrichUnsettled).toHaveBeenCalledWith(
      expect.anything(),
      "expense-1",
      expect.objectContaining({ aiEnabled: true, extraHints: [] })
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
      expect.objectContaining({ aiEnabled: false, extraHints: [] })
    );
  });

  it("checks without the AI when the flags can't be read, and still notifies", async () => {
    flags.getFeatureFlagStates.mockRejectedValue(new Error("db down"));
    const agent = vi.fn(async () => true);
    silenceErrors();

    expect(await runExpenseCheck("expense-1", { agent })).toBe("fallback");
    expect(agent).not.toHaveBeenCalled();
    expect(fixedSteps.enrichUnsettled).toHaveBeenCalledWith(
      expect.anything(),
      "expense-1",
      expect.objectContaining({ aiEnabled: false, extraHints: [INCOMPLETE] })
    );
    expect(approval.ensureApprovalChain).toHaveBeenCalledTimes(1);
  });

  it("builds the approval chain from the expense as stored, after the check", async () => {
    await runExpenseCheck("expense-1", { agent: async () => true });

    expect(approval.ensureApprovalChain).toHaveBeenCalledWith({
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
    });
    // Approvers hear of it only once the check has finished.
    expect(callOrder(fixedSteps.enrichUnsettled)).toBeLessThan(
      callOrder(approval.ensureApprovalChain)
    );
    // The state is written last, so a run that dies before notifying is
    // still running and the backstop finishes it.
    const stateWrite = db.updateRow.mock.invocationCallOrder.at(-1) ?? 0;
    expect(stateWrite).toBeGreaterThan(callOrder(approval.ensureApprovalChain));
    expect(finalState()).toMatchObject({ check_state: "done" });
    // The Stage 2 example sync now follows the notification.
    expect(examples.syncExamplesForExpense).toHaveBeenCalledWith(
      db,
      "expense-1",
      { confirmed: false }
    );
    expect(callOrder(examples.syncExamplesForExpense)).toBeGreaterThan(
      callOrder(approval.ensureApprovalChain)
    );
  });

  it("finishes the check when the background chain fails", async () => {
    approval.ensureApprovalChain.mockRejectedValue(
      new approval.ApprovalChainFailedError("mail down")
    );
    silenceErrors();

    const outcome = await runExpenseCheck("expense-1", {
      agent: async () => true,
    });

    // The issue is IT's to act on; the expense stays pending.
    expect(outcome).toBe("done");
    expect(finalState()).toMatchObject({ check_state: "done" });
    expect(expenseWrites().some((data) => "status" in data)).toBe(false);
    expect(examples.syncExamplesForExpense).toHaveBeenCalledTimes(1);
  });

  it("leaves the check running when the chain fails with nobody told", async () => {
    approval.ensureApprovalChain.mockRejectedValue(new Error("db down"));

    await expect(
      runExpenseCheck("expense-1", { agent: async () => true })
    ).rejects.toThrow("db down");
    expect(finalState()).toBeUndefined();
    expect(examples.syncExamplesForExpense).not.toHaveBeenCalled();
  });

  it("a finished check that runs again repairs it and tells nobody again", async () => {
    const agent = vi.fn(async () => true);
    for (const posting of [true, false]) {
      vi.clearAllMocks();
      flags.states.expenses_ledger_posting = posting;
      // A racing submit queued the finished check again.
      stored({ check_claim: 5, check_finished_at: FINISHED_AT });

      const outcome = await runExpenseCheck("expense-1", {
        agent,
        claim: 5,
        now: () => NOW,
      });

      expect(outcome).toBe("fallback");
      expect(agent).not.toHaveBeenCalled();
      expect(fixedSteps.enrichUnsettled).toHaveBeenCalledWith(
        expect.anything(),
        "expense-1",
        expect.objectContaining({ extraHints: [INCOMPLETE] })
      );
      expect(approval.ensureApprovalChain).not.toHaveBeenCalled();
      expect(messaging.createEmail).not.toHaveBeenCalled();
      expect(finalState()).toEqual({
        check_finished_at: "2026-11-19T12:00:00.000Z",
        check_state: "fallback",
      });
    }
  });

  it("the email goes out after the check, accounting's first", async () => {
    flags.states.expenses_ledger_posting = false;

    await runExpenseCheck("expense-1", { agent: async () => true });

    expect(approval.ensureApprovalChain).not.toHaveBeenCalled();
    const [toAccounting, toStudent] = messaging.createEmail.mock.calls.map(
      ([email]) => email
    );
    expect(toAccounting).toMatchObject({
      attachments: ["expenses:pdf-1", "expenses:file-1"],
      html: true,
      subject: "User Ada Lovelace has submitted expense 10042",
      users: ["invoice-user"],
    });
    expect(toStudent).toMatchObject({ html: true, users: ["user-1"] });
    expect(callOrder(fixedSteps.enrichUnsettled)).toBeLessThan(
      callOrder(messaging.createEmail)
    );
    // The submit wrote `pending`; the email writes no status.
    expect(expenseWrites().some((data) => "status" in data)).toBe(false);
    expect(finalState()).toMatchObject({ check_state: "done" });
    expect(callOrder(examples.syncExamplesForExpense)).toBeGreaterThan(
      callOrder(messaging.createEmail)
    );
  });

  it("a failed student copy fails nothing, and a re-run sends nothing again", async () => {
    flags.states.expenses_ledger_posting = false;
    messaging.createEmail
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("mail down"));
    silenceErrors();

    expect(
      await runExpenseCheck("expense-1", { agent: async () => true })
    ).toBe("done");
    expect(emailsTo("invoice-user")).toHaveLength(1);
    expect(finalState()).toMatchObject({ check_state: "done" });

    // The backstop, or a racing submit's queue, runs it again.
    const finished = finalState()?.check_finished_at as string;
    stored({ check_claim: 2, check_finished_at: finished });
    await runExpenseCheck("expense-1", { claim: 2 });

    expect(emailsTo("invoice-user")).toHaveLength(1);
    expect(emailsTo("user-1")).toHaveLength(1);
  });

  it("an accounting email that fails leaves the check running, and nobody got it", async () => {
    flags.states.expenses_ledger_posting = false;
    messaging.createEmail.mockRejectedValueOnce(new Error("mail down"));

    await expect(
      runExpenseCheck("expense-1", { agent: async () => true })
    ).rejects.toThrow("mail down");
    expect(emailsTo("user-1")).toHaveLength(0);
    expect(finalState()).toBeUndefined();
    expect(examples.syncExamplesForExpense).not.toHaveBeenCalled();
  });

  it("an email that can't be addressed leaves the check running for the backstop", async () => {
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
