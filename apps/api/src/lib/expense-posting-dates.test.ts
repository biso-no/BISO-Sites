import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
}));

const storage = vi.hoisted(() => ({ getFileDownload: vi.fn() }));

const finago = vi.hoisted(() => ({
  getFiscalYearLocks: vi.fn(),
  listFiscalPeriods: vi.fn(),
  postExpenseTransaction: vi.fn(),
  uploadDocument: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db, storage })),
}));

vi.mock("@repo/connectors/24sevenoffice", async () => {
  const actual = await vi.importActual<
    typeof import("@repo/connectors/24sevenoffice")
  >("@repo/connectors/24sevenoffice");
  return {
    ...actual,
    getFiscalYearLocks: finago.getFiscalYearLocks,
    listFiscalPeriods: finago.listFiscalPeriods,
    postExpenseTransaction: finago.postExpenseTransaction,
    uploadDocument: finago.uploadDocument,
  };
});

vi.mock("./pdf/expense-pdf", () => ({
  generateExpensePdf: vi.fn(async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    return await doc.save();
  }),
}));

vi.mock("./expense-approval-chain", () => ({
  assertApprovedExpenseChain: vi.fn(async () => undefined),
}));

import { postApprovedExpense } from "./expense-posting";

const expense = {
  $id: "exp-1",
  $sequence: 7,
  $updatedAt: "2026-11-01T00:00:00.000Z",
  ledger_transaction_id: null,
  bank_account: "1234.56.78901",
  campus: "1",
  department: "101",
  description: "Test",
  total: 300,
  userId: "u1",
  departmentRel: { Id: "101", Name: "OSL AI Club" },
  campusRel: { name: "Oslo" },
  expenseAttachments: [
    {
      $id: "att-1",
      url: "",
      type: "application/pdf",
      date: "2025-12-18T00:00:00.000+00:00",
      amount: 100,
      account_number: 7140,
      tax_code: 0,
      sort_order: 0,
    },
    {
      $id: "att-2",
      url: "",
      type: "application/pdf",
      date: "2026-10-10T00:00:00.000+00:00",
      amount: 200,
      account_number: 7140,
      tax_code: 0,
      sort_order: 1,
    },
  ],
};

function eventCalls() {
  return db.createRow.mock.calls.filter((c) => c[1] === "expense_events");
}

describe("postApprovedExpense booking dates", () => {
  beforeEach(() => {
    for (const fn of [
      ...Object.values(db),
      ...Object.values(storage),
      ...Object.values(finago),
    ]) {
      fn.mockReset();
    }
    db.getRow.mockImplementation(async (_d: string, table: string) =>
      table === "user"
        ? { name: "Test Student", email: "t@example.test" }
        : expense
    );
    db.listRows.mockResolvedValue({ rows: [] });
    db.incrementRowColumn.mockResolvedValue({ posting_lock: 1 });
    db.updateRow.mockResolvedValue({});
    db.createRow.mockResolvedValue({});
    finago.uploadDocument.mockResolvedValue({ documentId: 1 });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("posts each line on its booking date and records the shift", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([
      { startingDate: "2025-01-01", isLocked: true },
      { startingDate: "2026-01-01", isLocked: false },
    ]);
    finago.listFiscalPeriods.mockResolvedValue([
      { startingDate: "2026-01-01", endingDate: "2026-01-31" },
    ]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });

    await postApprovedExpense("exp-1");

    const receipts = finago.postExpenseTransaction.mock.calls[0][0].receipts;
    expect(
      receipts.map((r: { ref: string; date: string }) => [r.ref, r.date])
    ).toEqual([
      ["att-1", "2026-01-01"],
      ["att-2", "2026-10-10"],
    ]);
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense",
      "exp-1",
      expect.objectContaining({
        status: "success",
        ledger_transaction_id: "tx-9",
      })
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-1",
      { booked_date: "2026-01-01" }
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-2",
      { booked_date: "2026-10-10" }
    );
    expect(eventCalls().map((c) => c[3].action)).toEqual([
      "date_shifted",
      "booked",
    ]);
  });

  it("uses the retry shifts for the final booked date", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [
        {
          ref: "att-2",
          from: "2026-10-10",
          to: "2026-11-01",
          reason: "closed_period",
          finagoMessage: "Period closed",
        },
      ],
    });

    await postApprovedExpense("exp-1");

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "expense_attachments",
      "att-2",
      { booked_date: "2026-11-01" }
    );
    const shifted = eventCalls().find((c) => c[3].action === "date_shifted");
    expect(shifted?.[3]).toEqual(
      expect.objectContaining({
        attachment_id: "att-2",
        before: "2026-10-10",
        after: "2026-11-01",
      })
    );
    expect(shifted?.[3].note).toContain("Period closed");
  });

  it("keeps success when the history write fails", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });
    db.createRow.mockRejectedValue(new Error("appwrite down"));

    await expect(postApprovedExpense("exp-1")).resolves.toBeUndefined();
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "expense",
      "exp-1",
      expect.objectContaining({ status: "failed" })
    );
  });

  it("keeps success when a booked_date update fails", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });
    db.updateRow.mockImplementation((_d: string, table: string) =>
      table === "expense_attachments"
        ? Promise.reject(new Error("appwrite down"))
        : Promise.resolve({})
    );

    await expect(postApprovedExpense("exp-1")).resolves.toBeUndefined();
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "expense",
      "exp-1",
      expect.objectContaining({ status: "failed" })
    );
    expect(console.error).toHaveBeenCalled();
  });

  it("still posts when the year-lock lookup fails", async () => {
    finago.getFiscalYearLocks.mockRejectedValue(new Error("soap down"));
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });

    await postApprovedExpense("exp-1");
    expect(finago.postExpenseTransaction).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalled();
  });

  it("still posts when the period lookup fails", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockRejectedValue(new Error("rest down"));
    finago.postExpenseTransaction.mockResolvedValue({
      transactionId: "tx-9",
      shifts: [],
    });

    await postApprovedExpense("exp-1");
    expect(finago.postExpenseTransaction).toHaveBeenCalledTimes(1);
    expect(finago.postExpenseTransaction.mock.calls[0][0].periods).toEqual([]);
  });

  it("records booking_failed and marks the expense failed", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([]);
    finago.listFiscalPeriods.mockResolvedValue([]);
    finago.postExpenseTransaction.mockRejectedValue(
      new Error("Account 9999 does not exist")
    );

    await expect(postApprovedExpense("exp-1")).rejects.toThrow("Account 9999");
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "exp-1", {
      status: "failed",
    });
    const failed = eventCalls().find((c) => c[3].action === "booking_failed");
    expect(failed?.[3].note).toContain("Account 9999");
  });

  it("fails the posting when no open fiscal year follows a locked date", async () => {
    finago.getFiscalYearLocks.mockResolvedValue([
      { startingDate: "2025-01-01", isLocked: true },
    ]);
    finago.listFiscalPeriods.mockResolvedValue([]);

    await expect(postApprovedExpense("exp-1")).rejects.toThrow(
      "No open fiscal year"
    );
    expect(finago.postExpenseTransaction).not.toHaveBeenCalled();
    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "exp-1", {
      status: "failed",
    });
  });
});
