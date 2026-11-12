import { beforeEach, describe, expect, mock, test } from "bun:test";

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
const getExpenseViewer = mock();
mock.module("@/lib/expense-viewer", () => ({ getExpenseViewer }));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));

const { updateExpenseBankAccount, updateExpenseReceipt } = await import(
  "./actions"
);

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
    expect(result).toHaveProperty("error");
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

  test("recomputes the total after an amount change", async () => {
    const result = await updateExpenseReceipt({
      attachmentId: "a1",
      changes: { amount: 100.456 },
      expenseId: "ex1",
    });
    expect(result).toEqual({ data: { total: 150.46 } });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "a1",
      { amount: 100.46 }
    );
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "ex1", {
      total: 150.46,
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
    expect(events[1]).toMatchObject({ after: "150.46", before: "250" });
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
    expect(result).toHaveProperty("error");
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
