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
  buildApprovalCard: vi.fn(() => ({})),
  buildDecisionResultCard: vi.fn(() => ({ result: true })),
  ensureBotChatForUser: vi.fn(),
  sendApprovalEmail: vi.fn(),
  sendProactiveCard: vi.fn(),
  updateProactiveCard: vi.fn(),
}));
const cardDetails = vi.hoisted(() => ({ loadApprovalCardDetails: vi.fn() }));
const EMPTY_DETAILS = {
  declaration: null,
  fallbackNote: null,
  hints: [],
  history: [],
  missingAccount: false,
  receipts: [],
};
vi.mock("./expense-card-details", () => cardDetails);
const messaging = vi.hoisted(() => ({ createEmail: vi.fn() }));
vi.mock("@repo/connectors/teams-bot", () => ({
  buildApprovalCard: teams.buildApprovalCard,
  buildApprovalEmailHtml: vi.fn(() => "<p>approve</p>"),
  buildDecisionResultCard: teams.buildDecisionResultCard,
  ensureBotChatForUser: teams.ensureBotChatForUser,
  sendApprovalEmail: teams.sendApprovalEmail,
  sendProactiveCard: teams.sendProactiveCard,
  updateProactiveCard: teams.updateProactiveCard,
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
  teams.updateProactiveCard.mockReset().mockResolvedValue(undefined);
  teams.buildApprovalCard.mockClear();
  teams.buildDecisionResultCard.mockClear();
  cardDetails.loadApprovalCardDetails
    .mockReset()
    .mockResolvedValue(EMPTY_DETAILS);
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
      expect.objectContaining({ action: "notified", after: "fin@biso.no" }),
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

  const stepFor = (role: string, email: string, step: number) => ({
    aadId: null,
    directoryKey: `campus:1:${role}`,
    email,
    role,
    source: "default",
    step,
  });
  const issueRows = () =>
    db.createRow.mock.calls
      .filter(([, table]) => table === "expense_approval_issues")
      .map(([, , , data]) => data);
  const submitterIs = (email: string) =>
    db.getRow.mockImplementation(async (_db: string, table: string) =>
      table === "expense" ? { $id: "expense-1", userId: "user-1" } : { email }
    );

  it("rolls back steps and the claim when notification fails", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [ISSUE],
      steps: [
        stepFor("finance", "fin@biso.no", 1),
        stepFor("controller", "ctrl@biso.no", 2),
      ],
    });
    teams.sendApprovalEmail.mockRejectedValue(new Error("mail down"));
    db.deleteRow.mockResolvedValue({});

    await expect(createApprovalChain(CONTEXT)).rejects.toThrow(
      "Could not deliver"
    );

    expect(db.deleteRow).toHaveBeenCalledTimes(2);
    const claimId = db.createRow.mock.results[0]
      ? (await db.createRow.mock.results[0].value).$id
      : undefined;
    expect(db.deleteRow.mock.calls.map(([, , id]) => id)).toContain(claimId);
    expect(db.updateRow).toHaveBeenLastCalledWith(
      "app",
      "expense",
      "expense-1",
      { status: "draft" }
    );
    // No history or issues for a submission that never stood.
    expect(events.recordExpenseEvents).not.toHaveBeenCalled();
    expect(issueRows()).toEqual([]);
  });

  it("rolls back when a later step row cannot be created", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [
        stepFor("finance", "fin@biso.no", 1),
        stepFor("controller", "ctrl@biso.no", 2),
      ],
    });
    db.deleteRow.mockResolvedValue({});
    db.createRow
      .mockImplementationOnce(async (_d: string, _t: string, id: string) => ({
        $id: id,
        step: 1,
      }))
      .mockRejectedValueOnce(new Error("boom"));

    await expect(createApprovalChain(CONTEXT)).rejects.toThrow("boom");
    expect(db.deleteRow).toHaveBeenCalledTimes(1);
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "expense_approvals",
      (await db.createRow.mock.results[0].value).$id
    );
    expect(db.updateRow).toHaveBeenLastCalledWith(
      "app",
      "expense",
      "expense-1",
      { status: "draft" }
    );
  });

  it("a failed issue write does not strand the draft", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [ISSUE],
      steps: [CONTROLLER_STEP],
    });
    db.createRow.mockImplementation(
      (_d: string, table: string, id: string, data: object) =>
        table === "expense_approval_issues"
          ? Promise.reject(new Error("issue write failed"))
          : Promise.resolve({ $id: id, ...data })
    );
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(createApprovalChain(CONTEXT)).resolves.toEqual({
      notified: true,
      stepsCreated: 1,
    });

    expect(db.deleteRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "expense",
      "expense-1",
      { status: "draft" }
    );
    logged.mockRestore();
  });

  it("treats an approver who is the submitter as not found", async () => {
    submitterIs(" Fin@BISO.no ");
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [
        stepFor("finance", "fin@biso.no", 1),
        stepFor("controller", "ctrl@biso.no", 2),
      ],
    });

    const result = await createApprovalChain(CONTEXT);

    expect(result.stepsCreated).toBe(1);
    const rows = db.createRow.mock.calls
      .filter(([, table]) => table === "expense_approvals")
      .map(([, , , data]) => data);
    expect(rows).toEqual([
      expect.objectContaining({
        approver_email: "ctrl@biso.no",
        approver_role: "controller",
        step: 1,
      }),
    ]);
    expect(issueRows()).toEqual([
      expect.objectContaining({
        reason: "Approver is the submitter",
        role_sought: "finance",
      }),
    ]);
  });

  const approvalRows = () =>
    db.createRow.mock.calls
      .filter(([, table]) => table === "expense_approvals")
      .map(([, , , data]) => data);

  it("sends a controller who is the submitter to the campus default", async () => {
    submitterIs("ctrl@biso.no");
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [stepFor("controller", "ctrl@biso.no", 1)],
    });

    const result = await createApprovalChain(CONTEXT);

    expect(result).toEqual({ notified: true, stepsCreated: 1 });
    expect(approvalRows()).toEqual([
      expect.objectContaining({
        approver_email: "controller.oslo@biso.no",
        approver_role: "controller",
        directory_key: null,
        step: 1,
      }),
    ]);
    expect(teams.sendApprovalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "controller.oslo@biso.no" })
    );
    expect(issueRows()).toEqual([
      expect.objectContaining({
        reason: expect.stringContaining("Approver is the submitter"),
        role_sought: "controller",
      }),
    ]);
  });

  it("sends a president who is the submitter to national with the fallback marker", async () => {
    submitterIs("pres@biso.no");
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [stepFor("president", "pres@biso.no", 1)],
    });

    await createApprovalChain(CONTEXT);

    expect(approvalRows()).toEqual([
      expect.objectContaining({
        approver_role: "national",
        directory_key: null,
      }),
    ]);
    expect(events.recordExpenseEvents).toHaveBeenCalledWith(db, [
      expect.objectContaining({ note: "national (president fallback)" }),
      expect.objectContaining({ action: "notified" }),
    ]);
  });

  it("goes to the zero-steps branch when every candidate is the submitter", async () => {
    submitterIs("manager@biso.no");
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [stepFor("president", "manager@biso.no", 1)],
    });

    const result = await createApprovalChain(CONTEXT);

    expect(result).toEqual({ notified: false, stepsCreated: 0 });
    expect(tablesWritten()).toEqual([
      "expense_approval_issues",
      "expense_approval_issues",
    ]);
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "expense-1", {
      status: "pending",
    });
  });

  it("reads the submitter from the context user id without re-reading the expense", async () => {
    submitterIs("fin@biso.no");
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [
        stepFor("finance", "fin@biso.no", 1),
        stepFor("controller", "ctrl@biso.no", 2),
      ],
    });

    await createApprovalChain({ ...CONTEXT, submitterUserId: "user-9" });

    expect(db.getRow).toHaveBeenCalledTimes(1);
    expect(db.getRow).toHaveBeenCalledWith("app", "user", "user-9");
  });

  it("writes approver_resolved events before the notified event", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [
        stepFor("finance", "fin@biso.no", 1),
        stepFor("controller", "ctrl@biso.no", 2),
      ],
    });

    await createApprovalChain(CONTEXT);

    expect(events.recordExpenseEvents).toHaveBeenCalledTimes(1);
    const [, list] = events.recordExpenseEvents.mock.calls[0];
    expect(list.map((event: { action: string }) => event.action)).toEqual([
      "approver_resolved",
      "approver_resolved",
      "notified",
    ]);
  });

  it("drops the earlier of two steps with the same approver", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [
        stepFor("finance", "same@biso.no", 1),
        stepFor("controller", "Same@biso.no ", 2),
        stepFor("president", "pres@biso.no", 3),
      ],
    });

    const result = await createApprovalChain(CONTEXT);

    expect(result.stepsCreated).toBe(2);
    const rows = db.createRow.mock.calls
      .filter(([, table]) => table === "expense_approvals")
      .map(([, , , data]) => data);
    expect(rows.map((row) => [row.step, row.approver_role])).toEqual([
      [1, "controller"],
      [2, "president"],
    ]);
    expect(teams.sendApprovalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "same@biso.no" })
    );
    expect(issueRows()).toEqual([
      expect.objectContaining({
        reason: expect.stringContaining("earlier finance step was dropped"),
        role_sought: "finance",
      }),
    ]);
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
      expect.objectContaining({ action: "notified" }),
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

  it("notes Teams alone when the card was delivered but the email failed", async () => {
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [STEP],
    });
    teams.ensureBotChatForUser.mockResolvedValue("chat-1");
    teams.sendProactiveCard.mockResolvedValue("activity-1");
    teams.sendApprovalEmail.mockRejectedValue(new Error("smtp down"));

    await createApprovalChain(CONTEXT);

    expect(notifiedEvents()).toEqual([
      expect.objectContaining({ note: "teams" }),
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
      code: "not_current_step",
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
      code: "not_current_step",
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
      code: "link_expired",
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
    options: {
      approval?: object;
      directoryRows?: object[];
      missingSubmitter?: boolean;
      pending?: object[];
    } = {}
  ) {
    const row = { ...approval, ...options.approval };
    db.getRow.mockImplementation((_db: string, table: string) => {
      if (table === "expense_approvals") {
        return Promise.resolve(row);
      }
      if (table === "user") {
        return options.missingSubmitter
          ? Promise.reject(Object.assign(new Error("not found"), { code: 404 }))
          : Promise.resolve({ email: " Student@Biso.no " });
      }
      return Promise.resolve({
        $id: "expense-1",
        $sequence: 42,
        campus: "1",
        department: "dept-1",
        status: "pending",
        userId: "user-1",
      });
    });
    const rowsByTable: Record<string, object[]> = {
      expense_approvals: options.pending ?? [row],
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

    expect(result).toEqual({ directorySaved: true, notified: true, ok: true });
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

    expect(result).toMatchObject({ notified: false, ok: true });
    expect(
      db.createRow.mock.calls.some(
        ([, table]) => table === "expense_approval_issues"
      )
    ).toBe(true);
  });

  it("continues when the submitter row is missing", async () => {
    setup({ missingSubmitter: true });

    const result = await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    expect(result).toMatchObject({ ok: true });
  });

  it("refuses the current approver and writes nothing", async () => {
    setup();

    const result = await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: " OLD@biso.no ",
    });

    expect(result).toMatchObject({ code: "same_approver", ok: false });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
    expect(events.recordExpenseEvents).not.toHaveBeenCalled();
  });

  it("change refuses a decided step", async () => {
    setup({ approval: { status: "approved" }, directoryRows: [] });

    const result = await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    expect(result).toEqual({
      code: "not_current_step",
      error: "This step is not waiting for a decision.",
      ok: false,
    });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("refuses a pending step that is not current", async () => {
    const lower = { ...approval, $id: "approval-0", step: 1 };
    setup({
      approval: { $id: "approval-2", step: 2 },
      pending: [lower, { ...approval, $id: "approval-2", step: 2 }],
    });

    const result = await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-2",
      email: "new@biso.no",
    });

    expect(result).toMatchObject({ code: "not_current_step", ok: false });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("keys a finance step by the expense's department id, not the name", async () => {
    setup({
      approval: {
        approver_role: "finance",
        department: "Marketing",
        directory_key: null,
      },
    });

    await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    const created = db.createRow.mock.calls.find(
      ([, table]) => table === "expense_approvers"
    )?.[3];
    expect(created).toMatchObject({
      department_id: "dept-1",
      key: "dept:dept-1:finance",
      scope: "department",
    });
  });

  it("keys a controller step by campus with no department", async () => {
    setup({
      approval: {
        approver_role: "controller",
        department: "Marketing",
        directory_key: null,
      },
    });

    await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    const created = db.createRow.mock.calls.find(
      ([, table]) => table === "expense_approvers"
    )?.[3];
    expect(created).toMatchObject({
      department_id: null,
      key: "campus:1:controller",
      scope: "campus",
    });
  });

  it("uses the stored key but the expense's department id for a department role", async () => {
    setup({
      approval: {
        approver_role: "manager",
        department: "Marketing",
        directory_key: "dept:dept-1:manager",
      },
    });

    await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    const created = db.createRow.mock.calls.find(
      ([, table]) => table === "expense_approvers"
    )?.[3];
    expect(created).toMatchObject({
      department_id: "dept-1",
      key: "dept:dept-1:manager",
    });
  });

  it("refuses the submitter as the new approver", async () => {
    setup();

    const result = await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "  STUDENT@biso.no ",
    });

    expect(result).toMatchObject({ code: "self_approver", ok: false });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("reports directorySaved false when the directory write fails", async () => {
    setup();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.createRow.mockImplementation(
      (_db: string, table: string, id: string, data: object) =>
        table === "expense_approvers"
          ? Promise.reject(new Error("write failed"))
          : Promise.resolve({ $id: id, ...data })
    );

    const result = await changeStepApprover({
      actor: ACTOR,
      approvalId: "approval-1",
      email: "new@biso.no",
    });

    expect(result).toMatchObject({ directorySaved: false, ok: true });
  });
});

describe("card data and card updates", () => {
  const SENT = {
    $id: "approval-1",
    approver_email: "ctrl@biso.no",
    approver_role: "controller",
    decision_lock: 0,
    directory_key: null,
    expense_id: "expense-1",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    status: "pending",
    step: 1,
    teams_activity_id: "activity-1",
    teams_conversation_id: "chat-1",
    token_hash: createHash("sha256").update("raw-token").digest("hex"),
  };
  const ACTOR = {
    email: "Admin@biso.no",
    kind: "admin" as const,
    name: "Admin Person",
  };

  function setup() {
    db.listRows.mockImplementation((_db: string, table: string) =>
      Promise.resolve({ rows: table === "expense_approvals" ? [SENT] : [] })
    );
    db.getRow.mockImplementation((_db: string, table: string) =>
      Promise.resolve(
        table === "expense_approvals"
          ? SENT
          : {
              $id: "expense-1",
              $sequence: 42,
              status: "pending",
              userId: "user-1",
            }
      )
    );
    db.incrementRowColumn.mockResolvedValue({ decision_lock: 1 });
    db.decrementRowColumn.mockResolvedValue({});
  }

  it("notifyStep sends the admin link and the details", async () => {
    const details = {
      ...EMPTY_DETAILS,
      hints: ["The occasion is missing."],
      missingAccount: true,
    };
    cardDetails.loadApprovalCardDetails.mockResolvedValue(details);
    resolution.resolveExpenseApprovers.mockResolvedValue({
      issues: [],
      steps: [
        {
          aadId: "aad-1",
          directoryKey: "campus:1:controller",
          email: "ctrl@biso.no",
          role: "controller",
          source: "default",
          step: 1,
        },
      ],
    });
    teams.ensureBotChatForUser.mockResolvedValue("chat-1");
    teams.sendProactiveCard.mockResolvedValue("activity-1");

    await createApprovalChain(CONTEXT);

    expect(cardDetails.loadApprovalCardDetails).toHaveBeenCalledWith(
      db,
      "expense-1"
    );
    expect(teams.buildApprovalCard).toHaveBeenCalledWith(
      expect.objectContaining({
        ...details,
        adminUrl: "https://admin.biso.no/expenses/expense-1",
      })
    );
  });

  it("an admin decision updates the sent Teams card", async () => {
    setup();

    const result = await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "approved",
      onBehalf: false,
    });

    expect(result).toMatchObject({ ok: true });
    expect(teams.buildDecisionResultCard).toHaveBeenCalledWith({
      decidedBy: "Admin Person",
      decision: "approved",
      reimbursementNumber: expect.any(String),
    });
    expect(teams.updateProactiveCard).toHaveBeenCalledWith({
      activityId: "activity-1",
      card: { result: true },
      chatId: "chat-1",
      tenantId: expect.any(String),
    });
  });

  it("a web decision updates the sent Teams card", async () => {
    setup();

    await decideApproval({
      decidedBy: "Ctrl",
      decision: "rejected",
      rawToken: "raw-token",
      source: "web",
    });

    expect(teams.updateProactiveCard).toHaveBeenCalledTimes(1);
  });

  it("a Teams decision does not call updateProactiveCard", async () => {
    setup();

    await decideApproval({
      decidedBy: "Ctrl",
      decision: "approved",
      rawToken: "raw-token",
      source: "teams",
    });

    expect(teams.updateProactiveCard).not.toHaveBeenCalled();
  });

  it("a failed card update does not fail the decision", async () => {
    setup();
    teams.updateProactiveCard.mockRejectedValue(new Error("teams down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "approved",
      onBehalf: false,
    });

    expect(result).toMatchObject({ decision: "approved", ok: true });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("leaves a step without Teams ids alone", async () => {
    setup();
    db.getRow.mockImplementation((_db: string, table: string) =>
      Promise.resolve(
        table === "expense_approvals"
          ? { ...SENT, teams_activity_id: null, teams_conversation_id: null }
          : { $id: "expense-1", $sequence: 42, status: "pending", userId: "u" }
      )
    );

    await decideApprovalStep({
      actor: ACTOR,
      approvalId: "approval-1",
      decision: "approved",
      onBehalf: false,
    });

    expect(teams.updateProactiveCard).not.toHaveBeenCalled();
  });
});
