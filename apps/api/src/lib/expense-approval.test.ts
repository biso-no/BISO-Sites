import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
}));

const resolution = vi.hoisted(() => ({ resolveExpenseApprovers: vi.fn() }));
const events = vi.hoisted(() => ({ recordExpenseEvents: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db })),
}));
const teams = vi.hoisted(() => ({
  ensureBotChatForUser: vi.fn(),
  sendProactiveCard: vi.fn(),
}));
vi.mock("@repo/connectors/teams-bot", () => ({
  buildApprovalCard: vi.fn(() => ({})),
  buildApprovalEmailHtml: vi.fn(() => "<p>approve</p>"),
  ensureBotChatForUser: teams.ensureBotChatForUser,
  sendApprovalEmail: vi.fn(async () => undefined),
  sendProactiveCard: teams.sendProactiveCard,
}));
vi.mock("./expense-approver-resolution", () => resolution);
vi.mock("@repo/shared/utils/expense-events", () => events);

import {
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
    email: "ctrl@biso.no",
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
    db.listRows.mockImplementation((_db: string, table: string) =>
      Promise.resolve({
        rows: table === "expense_approvals" ? pending : [],
      })
    );
    db.incrementRowColumn.mockResolvedValue({ decision_lock: 1 });
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
    expect(directoryWrites()).toHaveLength(0);
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

describe("token decisions history", () => {
  it("token decisions record the approver email and confirm the directory row", async () => {
    const raw = "raw-token";
    const approval = {
      $id: "approval-1",
      approver_email: "ctrl@biso.no",
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
