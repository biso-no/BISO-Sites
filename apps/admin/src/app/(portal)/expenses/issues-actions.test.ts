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

const db = {
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
const getUserAuthContext = mock();
mock.module("@/lib/authorization", () => ({ getUserAuthContext }));
const callExpensesApi = mock();
const realFetch = globalThis.fetch;
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("../_actions/audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const {
  listExpenseApprovalIssues,
  resendExpenseApprovalNotification,
  resolveExpenseApprovalIssue,
} = await import("./issues-actions");

const viewer = (over: Record<string, unknown> = {}) => ({
  accountEmail: "ctrl@example.com",
  controllerCampusIds: [],
  emails: ["ctrl@example.com"],
  isCampusAdmin: false,
  isGlobalAdmin: false,
  managedCampusIds: [],
  name: "Someone",
  userId: "u1",
  ...over,
});

const issue = (over: Record<string, unknown> = {}) => ({
  $createdAt: "2026-11-01T00:00:00.000Z",
  $id: "i1",
  campus_id: "oslo",
  expense_id: "ex1",
  reason: "Could not notify the approver",
  status: "open",
  ...over,
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  for (const fn of [...Object.values(db), getExpenseViewer, callExpensesApi]) {
    fn.mockReset();
  }
  getUserAuthContext.mockReset();
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
  process.env.CRON_SECRET = "secret";
  globalThis.fetch = callExpensesApi as unknown as typeof fetch;
  getUserAuthContext.mockResolvedValue({ email: "x@biso.no", userId: "u1" });
  getExpenseViewer.mockResolvedValue(viewer());
  db.getRow.mockResolvedValue(issue());
  db.updateRow.mockResolvedValue({});
  db.listRows.mockResolvedValue({ rows: [issue()] });
  callExpensesApi.mockResolvedValue(Response.json({ ok: true }));
});

describe("issue actions", () => {
  test("issue actions refuse a campus admin resolve", async () => {
    getExpenseViewer.mockResolvedValue(
      viewer({ isCampusAdmin: true, managedCampusIds: ["oslo"] })
    );
    const result = await resolveExpenseApprovalIssue("i1");
    expect(result.success).toBe(false);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("controller may resend for own campus", async () => {
    getExpenseViewer.mockResolvedValue(
      viewer({ controllerCampusIds: ["oslo"] })
    );
    const result = await resendExpenseApprovalNotification("i1");
    expect(result.success).toBe(true);
    expect(callExpensesApi).toHaveBeenCalledTimes(1);
    expect(db.updateRow).toHaveBeenCalledTimes(1);
  });

  test("controller may not resend for another campus", async () => {
    getExpenseViewer.mockResolvedValue(
      viewer({ controllerCampusIds: ["bergen"] })
    );
    const result = await resendExpenseApprovalNotification("i1");
    expect(result.success).toBe(false);
    expect(callExpensesApi).not.toHaveBeenCalled();
  });

  test("resend uses the expense stored on the issue", async () => {
    getExpenseViewer.mockResolvedValue(viewer({ isGlobalAdmin: true }));
    await resendExpenseApprovalNotification("i1");
    const body = JSON.parse(
      (callExpensesApi.mock.calls[0]?.[1] as RequestInit).body as string
    );
    expect(body.expenseId).toBe("ex1");
  });

  test("global admin may resolve", async () => {
    getExpenseViewer.mockResolvedValue(viewer({ isGlobalAdmin: true }));
    const result = await resolveExpenseApprovalIssue("i1");
    expect(result.success).toBe(true);
    expect(db.updateRow).toHaveBeenCalledTimes(1);
  });

  test("listing scopes a campus admin to managed campuses and marks rows read-only", async () => {
    getExpenseViewer.mockResolvedValue(
      viewer({ isCampusAdmin: true, managedCampusIds: ["oslo"] })
    );
    const result = await listExpenseApprovalIssues();
    expect(result.data?.[0]?.canAct).toBe(false);
    const queries = db.listRows.mock.calls[0]?.[2] as string[];
    expect(queries.join("|")).toContain("oslo");
  });

  test("listing filters to open issues in the query, before the limit", async () => {
    getExpenseViewer.mockResolvedValue(viewer({ isGlobalAdmin: true }));
    await listExpenseApprovalIssues();
    const queries = db.listRows.mock.calls[0]?.[2] as string[];
    expect(queries).toContain(Query.equal("status", "open"));
  });

  test("a failed resend is an error code, not the server's text", async () => {
    getExpenseViewer.mockResolvedValue(viewer({ isGlobalAdmin: true }));
    callExpensesApi.mockResolvedValue(
      Response.json(
        { code: "in_progress", error: "Raw server words" },
        { status: 409 }
      )
    );
    expect(await resendExpenseApprovalNotification("i1")).toEqual({
      error: "in_progress",
      success: false,
    });
    callExpensesApi.mockResolvedValue(
      Response.json({ error: "Raw server words" }, { status: 500 })
    );
    expect(await resendExpenseApprovalNotification("i1")).toEqual({
      error: "api_failed",
      success: false,
    });
  });

  test("an unexpected failure is the generic code, not the exception text", async () => {
    getExpenseViewer.mockResolvedValue(viewer({ isGlobalAdmin: true }));
    db.updateRow.mockRejectedValue(new Error("db exploded"));
    const spy = spyOn(console, "error").mockImplementation(() => undefined);
    expect(await resolveExpenseApprovalIssue("i1")).toEqual({
      error: "failed",
      success: false,
    });
    spy.mockRestore();
  });

  test("listing refuses a viewer with no campus access", async () => {
    const result = await listExpenseApprovalIssues();
    expect(result.error).toBe("forbidden");
    expect(db.listRows).not.toHaveBeenCalled();
  });
});
