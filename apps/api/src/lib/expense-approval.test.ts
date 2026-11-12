import { createHash } from "node:crypto";
import { Query } from "@repo/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createRow: vi.fn(),
  decrementRowColumn: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
}));

const resolution = vi.hoisted(() => ({ resolveExpenseApprovers: vi.fn() }));
const events = vi.hoisted(() => ({ recordExpenseEvents: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db, messaging })),
}));
const teams = vi.hoisted(() => ({
  ensureBotChatForUser: vi.fn(),
  sendApprovalEmail: vi.fn(),
  sendProactiveCard: vi.fn(),
}));
const messaging = vi.hoisted(() => ({ createEmail: vi.fn() }));
vi.mock("@repo/connectors/teams-bot", () => ({
  buildApprovalCard: vi.fn(() => ({})),
  buildApprovalEmailHtml: vi.fn(() => "<p>approve</p>"),
  ensureBotChatForUser: teams.ensureBotChatForUser,
  sendApprovalEmail: teams.sendApprovalEmail,
  sendProactiveCard: teams.sendProactiveCard,
}));
const graph = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("./graph", () => ({ getGraphService: () => graph }));
vi.mock("./expense-approver-resolution", () => resolution);
vi.mock("@repo/shared/utils/expense-events", () => events);

import {
  changeStepApprover,
  createApprovalChain,
  decideApproval,
  decideApprovalStep,
  stepLabel,
} from "./expense-approval";

const CONTEXT = {
  campusId: "1",
  campusLabel: "Oslo",
  currency: "NOK",
  departmentId: "dept-1",
  departmentLabel: "Marketing",
  departmentName: "Marketing",
  description: "Travel",
  expenseId: "expense-1",
  reimbursementNumber: "10042",
  submitterIsController: false,
  submitterIsFinancialManager: false,
  submitterName: "Ada",
  total: 100,
};

beforeEach(() => {
  for (const fn of Object.values(db)) {
    fn.mockReset();
  }
  resolution.resolveExpenseApprovers.mockReset();
  events.recordExpenseEvents.mockReset();
  teams.ensureBotChatForUser.mockReset().mockResolvedValue(null);
  teams.sendProactiveCard.mockReset().mockResolvedValue(null);
  teams.sendApprovalEmail.mockReset().mockResolvedValue(undefined);
  messaging.createEmail.mockReset().mockResolvedValue({});
  db.createRow.mockImplementation(
    async (_db: string, _table: string, id: string, data: object) => ({
      $id: id,
      ...data,
    })
  );
  db.updateRow.mockResolvedValue({});
});

describe("approval chain", () => {
  it("writes the directory key and an approver_resolved event per step", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [
        {
          aadId: null,
          directoryKey: "dept:dept-1:finance",
          email: "fin@biso.no",
          role: "finance",
          source: "ai",
          step: 1,
        },
        {
          aadId: null,
          directoryKey: "campus:1:controller",
          email: "ctrl@biso.no",
          role: "controller",
          source: "default",
          step: 2,
        },
      ],
    });

    await createApprovalChain(CONTEXT);

    const approvalRows = db.createRow.mock.calls
      .filter(([, table]) => table === "expense_approvals")
      .map(([, , , data]) => data);
    expect(approvalRows.map((row) => row.directory_key)).toEqual([
      "dept:dept-1:finance",
      "campus:1:controller",
    ]);
    expect(events.recordExpenseEvents).toHaveBeenCalledWith(db, [
      {
        action: "approver_resolved",
        actorKind: "system",
        after: "fin@biso.no",
        expenseId: "expense-1",
        note: "finance via ai",
      },
      {
        action: "approver_resolved",
        actorKind: "system",
        after: "ctrl@biso.no",
        expenseId: "expense-1",
        note: "controller via default",
      },
    ]);
  });

  it("stores approver_email trimmed and lowercased", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [{ ...CONTROLLER_STEP, email: " Ctrl@BISO.no " }],
    });

    await createApprovalChain(CONTEXT);

    const row = db.createRow.mock.calls.find(
      ([, table]) => table === "expense_approvals"
    )?.[3];
    expect(row?.approver_email).toBe("ctrl@biso.no");
  });

  const ISSUE = {
    campusId: "1",
    department: "Marketing",
    reason: "No finance approver in the directory",
    roleSought: "finance",
  };
  const CONTROLLER_STEP = {
    aadId: null,
    directoryKey: "campus:1:controller",
    email: "ctrl@biso.no",
    role: "controller",
    source: "default",
    step: 1,
  };
  const tablesWritten = () =>
    db.createRow.mock.calls.map(([, table]) => table as string);

  it("records resolution issues only after the chain rows hold the claim", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [ISSUE],
      steps: [CONTROLLER_STEP],
    });

    await createApprovalChain(CONTEXT);

    expect(tablesWritten()).toEqual([
      "expense_approvals",
      "expense_approval_issues",
    ]);
  });

  it("records no issue when a racing submit already holds the claim", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [ISSUE],
      steps: [CONTROLLER_STEP],
    });
    db.createRow.mockRejectedValueOnce(
      Object.assign(new Error("Row already exists"), { code: 409 })
    );

    await expect(createApprovalChain(CONTEXT)).rejects.toMatchObject({
      code: 409,
    });
    expect(tablesWritten()).toEqual(["expense_approvals"]);
  });

  it("records an issue before leaving an expense with no approver pending", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [ISSUE],
      steps: [],
    });

    const result = await createApprovalChain(CONTEXT);

    expect(result).toEqual({ notified: false, stepsCreated: 0 });
    const issueRows = db.createRow.mock.calls
      .filter(([, table]) => table === "expense_approval_issues")
      .map(([, , , data]) => data);
    expect(issueRows).toEqual([
      expect.objectContaining({ role_sought: "finance" }),
      expect.objectContaining({
        campus_id: "1",
        department: "Marketing",
        expense_id: "expense-1",
        reason: expect.stringContaining("No approver could be resolved"),
        role_sought: "controller",
        status: "open",
      }),
    ]);
    const issuedAt = Math.max(...db.createRow.mock.invocationCallOrder);
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "expense-1", {
      status: "pending",
    });
    expect(db.updateRow.mock.invocationCallOrder[0]).toBeGreaterThan(issuedAt);
  });

  it("notes the national approver as the president fallback", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [
        {
          aadId: null,
          directoryKey: "campus:5:national",
          email: "manager@biso.no",
          fallbackFor: "president",
          role: "national",
          source: "default",
          step: 1,
        },
      ],
    });

    await createApprovalChain({ ...CONTEXT, submitterIsController: true });

    expect(events.recordExpenseEvents).toHaveBeenCalledWith(db, [
      expect.objectContaining({
        after: "manager@biso.no",
        note: "national (president fallback)",
      }),
    ]);
  });

  it("passes the controller declaration and campus name to resolution", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [],
    });

    await createApprovalChain({ ...CONTEXT, submitterIsController: true });

    expect(resolution.resolveExpenseApprovers).toHaveBeenCalledWith(
      expect.objectContaining({
        campusName: "Oslo",
        submitterIsController: true,
      }),
      { db }
    );
  });
});

describe("notification history", () => {
  const STEP = {
    aadId: "aad-1",
    directoryKey: "campus:1:controller",
    email: "Ctrl@BISO.no",
    role: "controller",
    source: "default",
    step: 1,
  };
  const notifiedEvents = () =>
    events.recordExpenseEvents.mock.calls
      .flatMap(([, list]) => list as { action: string }[])
      .filter((event) => event.action === "notified");

  it("notifyStep records a notified event for email only", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [{ ...STEP, aadId: null }],
    });

    await createApprovalChain(CONTEXT);

    expect(notifiedEvents()).toEqual([
      {
        action: "notified",
        actorKind: "system",
        after: "ctrl@biso.no",
        expenseId: "expense-1",
        note: "email",
      },
    ]);
  });

  it("records no notified event when neither channel delivered", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [{ ...STEP, aadId: null }],
    });
    teams.sendApprovalEmail.mockRejectedValue(new Error("smtp down"));

    await expect(createApprovalChain(CONTEXT)).rejects.toThrow();

    expect(notifiedEvents()).toEqual([]);
  });

  it("notes Teams as well when the card was delivered", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [STEP],
    });
    teams.ensureBotChatForUser.mockResolvedValue("chat-1");
    teams.sendProactiveCard.mockResolvedValue("activity-1");

    await createApprovalChain(CONTEXT);

    expect(notifiedEvents()).toEqual([
      expect.objectContaining({ note: "teams,email" }),
    ]);
  });
});

describe("step labels", () => {
  it("labels the president step", () => {
    expect(stepLabel("president", 1, 1)).toBe("Campus president");
  });
});

describe("decideApproval", () => {
  const RAW = "raw-token";
  const KEY = "campus:1:controller";

  function setup(approvalOver: object, entryEmail: string) {
    const approval = {
      $id: "approval-1",
      approver_email: "ctrl@biso.no",
      decision_lock: 0,
      directory_key: KEY,
      expense_id: "expense-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      status: "pending",
      step: 1,
      token_hash: createHash("sha256").update(RAW).digest("hex"),
      ...approvalOver,
    };
    db.listRows.mockImplementation((_db: string, table: string) => {
      if (table === "expense_approvals") {
        return Promise.resolve({ rows: [approval] });
      }
      if (table === "expense_approvers") {
        return Promise.resolve({
          rows: [{ $id: "entry-1", email: entryEmail, key: KEY }],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    db.getRow.mockResolvedValue({
      $id: "expense-1",
      $sequence: 42,
      campus: "1",
      total: 100,
      userId: "user-1",
    });
    db.incrementRowColumn.mockResolvedValue({ decision_lock: 1 });
  }

  const confirmed = () =>
    db.updateRow.mock.calls.filter(
      ([, table]) => table === "expense_approvers"
    );

  it("confirms the directory entry when its approver approves", async () => {
    setup({}, "ctrl@biso.no");

    const result = await decideApproval({
      decidedBy: "ctrl@biso.no",
      decision: "approved",
      rawToken: RAW,
    });

    expect(result.ok).toBe(true);
    expect(confirmed()).toHaveLength(1);
    expect(confirmed()[0]?.[2]).toBe("entry-1");
  });

  it("confirms the directory entry only when the approver email matches", async () => {
    setup({ approver_email: "other@biso.no" }, "ctrl@biso.no");

    const result = await decideApproval({
      decidedBy: "other@biso.no",
      decision: "approved",
      rawToken: RAW,
    });

    expect(result.ok).toBe(true);
    expect(confirmed()).toHaveLength(0);
  });

  it("confirms nothing on a rejection or when the row has no directory key", async () => {
    setup({}, "ctrl@biso.no");
    await decideApproval({
      decidedBy: "ctrl@biso.no",
      decision: "rejected",
      rawToken: RAW,
    });
    expect(confirmed()).toHaveLength(0);
  });

  it("approves without a directory key and confirms nothing", async () => {
    setup({ directory_key: null }, "ctrl@biso.no");
    const result = await decideApproval({
      decidedBy: "ctrl@biso.no",
      decision: "approved",
      rawToken: RAW,
    });
    expect(result.ok).toBe(true);
    expect(confirmed()).toHaveLength(0);
  });
});

describe("decideApprovalStep", () => {
  const baseApproval = {
    $id: "approval-1",
    approver_email: "ctrl@biso.no",
    approver_role: "controller",
    decision_lock: 0,
    directory_key: "campus:1:controller",
    expense_id: "expense-1",
    status: "pending",
    step: 1,
  };
  const ACTOR = {
    email: "Admin@biso.no",
    kind: "admin" as const,
    name: "Admin Person",
  };

  function setup(
    options: {
      approval?: object;
      expenseStatus?: string;
      pending?: object[];
    } = {}
  ) {
    const approval = { ...baseApproval, ...options.approval };
    const pending = options.pending ?? [approval];
    db.getRow.mockImplementation((_db: string, table: string) =>
      Promise.resolve(
        table === "expense_approvals"
          ? approval
          : {
              $id: "expense-1",
              $sequence: 42,
              status: options.expenseStatus ?? "pending",
              userId: "user-1",
            }
      )
    );
    db.listRows.mockImplementation((_db: string, table: string) => {
      if (table === "expense_approvals") {
        return Promise.resolve({ rows: pending });
      }
      if (table === "expense_approvers") {
        return Promise.resolve({
          rows: [
            {
              $id: "entry-1",
              email: "ctrl@biso.no",
              key: "campus:1:controller",
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    db.incrementRowColumn.mockResolvedValue({ decision_lock: 1 });
    db.decrementRowColumn.mockResolvedValue({});
    return approval;
  }

  const stepWrite = () =>
    db.updateRow.mock.calls.find(
      ([, table]) => table === "expense_approvals"
    )?.[3];
  const directoryWrites = () =>
    db.updateRow.mock.calls.filter(
      ([, table]) => table === "expense_approvers"
    );

  it("decides the current step by id and advances the chain", async () => {
    const next = { ...baseApproval, $id: "approval-2", step: 2 };
    setup({ pending: [{ ...baseApproval }, next] });
    // After the claim the lookup of the next pending step returns step 2.
    db.listRows
      .mockResolvedValueOnce({ rows: [{ ...baseApproval }] })
      .mockResolvedValue({ rows: [next] });

    const result = await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "approved",
      onBehalf: false,
    });

    expect(result).toEqual({
      decision: "approved",
      expenseId: "expense-1",
      finalized: false,
      ok: true,
      reimbursementNumber: expect.any(String),
    });
    expect(stepWrite()).toMatchObject({
      decided_by: "Admin Person",
      decided_by_email: "admin@biso.no",
      on_behalf: false,
      status: "approved",
    });
  });

  it("refuses a step that is not the current one", async () => {
    const first = { ...baseApproval, $id: "approval-1", step: 1 };
    setup({
      approval: { $id: "approval-2", step: 2 },
      pending: [first, { ...baseApproval, $id: "approval-2", step: 2 }],
    });

    const result = await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-2",
      decision: "approved",
      onBehalf: false,
    });

    expect(result).toEqual({
      error: "This step is not waiting for a decision.",
      ok: false,
    });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
  });

  it("refuses when the expense is not pending", async () => {
    setup({ expenseStatus: "rejected" });

    const result = await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "approved",
      onBehalf: false,
    });

    expect(result).toEqual({
      error: "This step is not waiting for a decision.",
      ok: false,
    });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
  });

  it("returns the existing outcome when the step is already decided", async () => {
    setup({ approval: { status: "approved" }, expenseStatus: "approved" });

    const result = await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "rejected",
      onBehalf: false,
    });

    expect(result).toMatchObject({
      decision: "approved",
      finalized: true,
      ok: true,
    });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
    expect(events.recordExpenseEvents).not.toHaveBeenCalled();
  });

  it("records an approved event with the on-behalf note and skips directory confirmation", async () => {
    setup();

    await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "approved",
      onBehalf: true,
    });

    expect(stepWrite()).toMatchObject({ on_behalf: true });
    expect(directoryWrites()).toHaveLength(0);
    expect(events.recordExpenseEvents).toHaveBeenCalledWith(db, [
      {
        action: "approved",
        actorEmail: "admin@biso.no",
        actorKind: "admin",
        actorName: "Admin Person",
        expenseId: "expense-1",
        note: "On behalf of the campus controller",
      },
    ]);
  });

  it("records a rejected event with the reason", async () => {
    setup();

    const result = await decideApprovalStep({
      actor: { ...ACTOR, email: null },
      approvalId: "approval-1",
      decision: "rejected",
      onBehalf: true,
      reason: "No receipt",
    });

    expect(result).toMatchObject({ decision: "rejected", ok: true });
    expect(events.recordExpenseEvents).toHaveBeenCalledWith(db, [
      expect.objectContaining({
        action: "rejected",
        actorEmail: null,
        note: "On behalf of the campus controller · Reason: No receipt",
      }),
    ]);
  });

  it("records a null note when there is no reason and no delegation", async () => {
    setup();

    await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "approved",
      onBehalf: false,
    });

    expect(events.recordExpenseEvents).toHaveBeenCalledWith(db, [
      expect.objectContaining({ note: null }),
    ]);
    expect(directoryWrites()).toHaveLength(1);
  });

  it("looks up the current step as the lowest pending one", async () => {
    setup();

    await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "approved",
      onBehalf: false,
    });

    const lookup = db.listRows.mock.calls.find(
      ([, table]) => table === "expense_approvals"
    );
    expect(lookup?.[2]).toEqual([
      Query.equal("expense_id", "expense-1"),
      Query.equal("status", "pending"),
      Query.orderAsc("step"),
      Query.limit(1),
    ]);
  });

  it("trims the reason and drops a blank one from the note", async () => {
    setup();
    await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "rejected",
      onBehalf: false,
      reason: "  No receipt  ",
    });
    setup();
    await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "rejected",
      onBehalf: false,
      reason: "   ",
    });

    const notes = events.recordExpenseEvents.mock.calls.map(
      ([, list]) => list[0].note
    );
    expect(notes).toEqual(["Reason: No receipt", null]);
  });

  it("records no decision event when the step write fails", async () => {
    setup();
    db.updateRow.mockRejectedValueOnce(new Error("write failed"));

    await expect(
      decideApprovalStep({
        actor: ACTOR,
        approvalId: "approval-1",
        decision: "approved",
        onBehalf: false,
      })
    ).rejects.toThrow("write failed");

    expect(events.recordExpenseEvents).not.toHaveBeenCalled();
  });

  it("reports a missing step instead of throwing", async () => {
    db.getRow.mockRejectedValue(
      Object.assign(new Error("nope"), { code: 404 })
    );

    const result = await decideApprovalStep({
      actor: ACTOR,
      approvalId: "missing",
      decision: "approved",
      onBehalf: false,
    });

    expect(result.ok).toBe(false);
  });
});

describe("token decision paths", () => {
  const RAW = "raw-token";
  const row = (over: object = {}) => ({
    $id: "approval-1",
    approver_email: "ctrl@biso.no",
    approver_role: "controller",
    decision_lock: 0,
    directory_key: null,
    expense_id: "expense-1",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    status: "pending",
    step: 1,
    token_hash: createHash("sha256").update(RAW).digest("hex"),
    ...over,
  });
  const decide = (decision: "approved" | "rejected" = "approved") =>
    decideApproval({ decidedBy: "Ctrl", decision, rawToken: RAW });

  function setup(approval: object, others: object[] = []) {
    db.listRows.mockImplementation(
      (_db: string, table: string, queries: unknown[]) => {
        if (table !== "expense_approvals") {
          return Promise.resolve({ rows: [] });
        }
        const isTokenLookup = JSON.stringify(queries).includes("token_hash");
        return Promise.resolve({ rows: isTokenLookup ? [approval] : others });
      }
    );
    db.getRow.mockResolvedValue({
      $id: "expense-1",
      $sequence: 42,
      userId: "user-1",
    });
    db.incrementRowColumn.mockResolvedValue({ decision_lock: 1 });
    db.decrementRowColumn.mockResolvedValue({});
  }

  it("returns the expiry error and never claims an expired link", async () => {
    setup(row({ expires_at: new Date(Date.now() - 1000).toISOString() }));

    expect(await decide()).toEqual({
      error: "This approval link has expired.",
      ok: false,
    });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
  });

  it("releases the claim and rethrows when the step write fails", async () => {
    setup(row());
    db.updateRow.mockRejectedValueOnce(new Error("write failed"));

    await expect(decide()).rejects.toThrow("write failed");

    expect(db.decrementRowColumn).toHaveBeenCalledWith(
      expect.objectContaining({ column: "decision_lock", min: 0 })
    );
    expect(events.recordExpenseEvents).not.toHaveBeenCalled();
  });

  it("returns the concurrent outcome when the claim is lost", async () => {
    setup(row());
    db.incrementRowColumn.mockResolvedValue({ decision_lock: 2 });
    db.getRow.mockImplementation((_db: string, table: string) =>
      Promise.resolve(
        table === "expense_approvals"
          ? row({ status: "approved" })
          : { $id: "expense-1", $sequence: 42 }
      )
    );

    expect(await decide()).toMatchObject({ decision: "approved", ok: true });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(events.recordExpenseEvents).not.toHaveBeenCalled();
  });

  it("notifies the submitter of a rejection", async () => {
    setup(row());

    const result = await decide("rejected");

    expect(result).toMatchObject({ decision: "rejected", ok: true });
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "expense-1", {
      status: "rejected",
    });
    expect(messaging.createEmail).toHaveBeenCalledTimes(1);
    expect(messaging.createEmail.mock.calls[0]?.[4]).toEqual(["user-1"]);
  });

  it("records an issue and still succeeds when the next step cannot be notified", async () => {
    const next = row({
      $id: "approval-2",
      approver_email: "next@biso.no",
      step: 2,
    });
    setup(row(), [next]);
    teams.sendApprovalEmail.mockRejectedValue(new Error("smtp down"));

    const result = await decide();

    expect(result).toMatchObject({
      decision: "approved",
      finalized: false,
      ok: true,
    });
    const issues = db.createRow.mock.calls.filter(
      ([, table]) => table === "expense_approval_issues"
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.[3]).toMatchObject({
      expense_id: "expense-1",
      status: "open",
    });
  });
});

describe("token decisions history", () => {
  it("token decisions record the approver email and confirm the directory row", async () => {
    const raw = "raw-token";
    const approval = {
      $id: "approval-1",
      approver_email: "Ctrl@BISO.no",
      approver_role: "controller",
      decision_lock: 0,
      directory_key: "campus:1:controller",
      expense_id: "expense-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      status: "pending",
      step: 1,
      token_hash: createHash("sha256").update(raw).digest("hex"),
    };
    db.listRows.mockImplementation((_db: string, table: string) =>
      Promise.resolve({
        rows:
          table === "expense_approvers"
            ? [
                {
                  $id: "entry-1",
                  email: "ctrl@biso.no",
                  key: "campus:1:controller",
                },
              ]
            : [approval],
      })
    );
    db.getRow.mockResolvedValue({ $id: "expense-1", $sequence: 42 });
    db.incrementRowColumn.mockResolvedValue({ decision_lock: 1 });

    await decideApproval({
      decidedBy: "Ctrl Person",
      decision: "approved",
      rawToken: raw,
    });

    const write = db.updateRow.mock.calls.find(
      ([, table]) => table === "expense_approvals"
    )?.[3];
    expect(write).toMatchObject({
      decided_by: "Ctrl Person",
      decided_by_email: "ctrl@biso.no",
      on_behalf: false,
    });
    expect(
      db.updateRow.mock.calls.filter(([, t]) => t === "expense_approvers")
    ).toHaveLength(1);
    expect(events.recordExpenseEvents).toHaveBeenCalledWith(db, [
      {
        action: "approved",
        actorEmail: "ctrl@biso.no",
        actorKind: "approver",
        actorName: "Ctrl Person",
        expenseId: "expense-1",
        note: null,
      },
    ]);
  });
});

describe("changeStepApprover", () => {
  const approval = {
    $id: "approval-1",
    approver_aad_id: null,
    approver_email: "old@biso.no",
    approver_role: "controller",
    campus_id: "1",
    department: null,
    directory_key: "campus:1:controller",
    expense_id: "expense-1",
    status: "pending",
    step: 1,
  };
  const ACTOR = { email: "it@biso.no", kind: "admin" as const, name: "IT" };

  function setup(
    options: { approval?: object; directoryRows?: object[] } = {}
  ) {
    const row = { ...approval, ...options.approval };
    db.getRow.mockImplementation((_db: string, table: string) =>
      Promise.resolve(
        table === "expense_approvals"
          ? row
          : {
              $id: "expense-1",
              $sequence: 42,
              campus: "1",
              status: "pending",
              userId: "user-1",
            }
      )
    );
    const rowsByTable: Record<string, object[]> = {
      expense_approvals: [row],
      expense_approvers: options.directoryRows ?? [],
    };
    db.listRows.mockImplementation((_db: string, table: string) =>
      Promise.resolve({ rows: rowsByTable[table] ?? [] })
    );
    graph.getUser.mockReset().mockResolvedValue({
      displayName: "New Person",
      id: "aad-new",
    });
    return row;
  }

  it("changes the approver, saves the directory row as admin and re-sends", async () => {
    setup();

    const result = await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: " New@BISO.no ",
    });

    expect(result).toEqual({ notified: true, ok: true });
    const stepWrites = db.updateRow.mock.calls
      .filter(([, table]) => table === "expense_approvals")
      .map(([, , , data]) => data);
    expect(stepWrites[0]).toEqual({
      approver_aad_id: "aad-new",
      approver_email: "new@biso.no",
    });
    const directoryCreate = db.createRow.mock.calls.find(
      ([, table]) => table === "expense_approvers"
    )?.[3];
    expect(directoryCreate).toMatchObject({
      active: true,
      confirmed_at: null,
      confidence: null,
      display_name: "New Person",
      aad_id: "aad-new",
      email: "new@biso.no",
      key: "campus:1:controller",
      source: "admin",
    });
    expect(events.recordExpenseEvents).toHaveBeenCalledWith(db, [
      {
        action: "approver_resolved",
        actorEmail: "it@biso.no",
        actorKind: "admin",
        actorName: "IT",
        after: "new@biso.no",
        before: "old@biso.no",
        expenseId: "expense-1",
        field: "approver_email",
        note: "changed in admin",
      },
    ]);
    expect(teams.sendApprovalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "new@biso.no" })
    );
  });

  it("overwrites an existing confirmed directory row", async () => {
    setup({
      directoryRows: [
        {
          $id: "entry-1",
          email: "old@biso.no",
          key: "campus:1:controller",
          source: "confirmed",
        },
      ],
    });

    await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    const update = db.updateRow.mock.calls.find(
      ([, table]) => table === "expense_approvers"
    );
    expect(update?.[2]).toBe("entry-1");
    expect(update?.[3]).toMatchObject({
      active: true,
      confirmed_at: null,
      email: "new@biso.no",
      source: "admin",
    });
  });

  it("builds the directory key from the row when it has none", async () => {
    setup({ approval: { directory_key: null } });

    await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    const created = db.createRow.mock.calls.find(
      ([, table]) => table === "expense_approvers"
    )?.[3];
    expect(created?.key).toBe("campus:1:controller");
  });

  it("still changes the approver when Graph cannot find the person", async () => {
    setup();
    graph.getUser.mockRejectedValue(new Error("timeout"));

    const result = await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    expect(result.ok).toBe(true);
    const step = db.updateRow.mock.calls.find(
      ([, table]) => table === "expense_approvals"
    )?.[3];
    expect(step).toEqual({
      approver_aad_id: null,
      approver_email: "new@biso.no",
    });
  });

  it("reports notified false and records an issue when the notice fails", async () => {
    setup();
    teams.sendApprovalEmail.mockRejectedValue(new Error("mail down"));

    const result = await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    expect(result).toEqual({ notified: false, ok: true });
    expect(
      db.createRow.mock.calls.some(
        ([, table]) => table === "expense_approval_issues"
      )
    ).toBe(true);
  });

  it("change refuses a decided step", async () => {
    setup({ approval: { status: "approved" }, directoryRows: [] });

    const result = await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    expect(result).toEqual({
      error: "This step is not waiting for a decision.",
      ok: false,
    });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });
});
