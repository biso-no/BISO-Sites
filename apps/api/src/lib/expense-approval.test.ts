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
vi.mock("@repo/connectors/teams-bot", () => ({
  buildApprovalCard: vi.fn(() => ({})),
  buildApprovalEmailHtml: vi.fn(() => "<p>approve</p>"),
  ensureBotChatForUser: vi.fn(async () => null),
  sendApprovalEmail: vi.fn(async () => undefined),
  sendProactiveCard: vi.fn(async () => null),
}));
vi.mock("./expense-approver-resolution", () => resolution);
vi.mock("@repo/shared/utils/expense-events", () => events);

import {
  createApprovalChain,
  decideApproval,
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
