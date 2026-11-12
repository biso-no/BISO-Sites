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
const oslo = vi.hoisted(() => ({ todayInOslo: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db, storage })),
}));
vi.mock("@repo/connectors/24sevenoffice", async () => {
  const actual = await vi.importActual<
    typeof import("@repo/connectors/24sevenoffice")
  >("@repo/connectors/24sevenoffice");
  return { ...actual, ...finago };
});
vi.mock("./pdf/expense-pdf", () => ({
  generateExpensePdf: vi.fn(async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    return await doc.save();
  }),
}));
vi.mock("./receipt-scan", () => ({ findScan: vi.fn() }));
vi.mock("./expense-examples", () => ({ writeExamples: vi.fn() }));
vi.mock("./expense-approval-chain", () => ({
  assertApprovedExpenseChain: vi.fn(async () => undefined),
}));
vi.mock("./receipt-date", async () => {
  const actual =
    await vi.importActual<typeof import("./receipt-date")>("./receipt-date");
  return { ...actual, todayInOslo: oslo.todayInOslo };
});

import { postApprovedExpense, retryExpenseBooking } from "./expense-posting";

const ACTOR = { email: "it@biso.no", kind: "admin" as const, name: "IT" };

const expense = {
  $id: "exp-1",
  $sequence: 7,
  $updatedAt: "2026-11-01T00:00:00.000Z",
  bank_account: "1234.56.78901",
  campus: "1",
  campusRel: { name: "Oslo" },
  department: "101",
  departmentRel: { Id: "101", Name: "OSL AI Club" },
  description: "Test",
  expenseAttachments: [
    {
      $id: "att-1",
      account_number: 7140,
      amount: 100,
      date: "2026-10-10T00:00:00.000+00:00",
      sort_order: 0,
      tax_code: 0,
      type: "application/pdf",
      url: "",
    },
  ],
  ledger_transaction_id: null,
  status: "approved",
  total: 100,
  userId: "u1",
};

const eventActions = () =>
  db.createRow.mock.calls
    .filter(([, table]) => table === "expense_events")
    .map(([, , , data]) => data.action);

beforeEach(() => {
  for (const fn of [
    ...Object.values(db),
    ...Object.values(storage),
    ...Object.values(finago),
  ]) {
    fn.mockReset();
  }
  oslo.todayInOslo.mockReset().mockReturnValue("2026-11-12");
  db.getRow.mockImplementation(async (_d: string, table: string) =>
    table === "user" ? { email: "t@example.test", name: "Student" } : expense
  );
  db.listRows.mockResolvedValue({ rows: [] });
  db.incrementRowColumn.mockResolvedValue({
    posting_lock: 1,
    status: "failed",
  });
  db.updateRow.mockResolvedValue({});
  db.createRow.mockResolvedValue({});
  finago.getFiscalYearLocks.mockResolvedValue([]);
  finago.listFiscalPeriods.mockResolvedValue([]);
  finago.uploadDocument.mockResolvedValue({ documentId: 1 });
  finago.postExpenseTransaction.mockResolvedValue({
    shifts: [],
    transactionId: "tx-1",
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("retryExpenseBooking", () => {
  it("refuses retry when a transaction id is stored", async () => {
    db.getRow.mockResolvedValue({
      ...expense,
      ledger_transaction_id: "tx-77",
      status: "failed",
    });

    const result = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });

    expect(result).toEqual({
      code: "already_booked",
      error: "Already booked as tx-77.",
      ok: false,
    });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
    expect(finago.postExpenseTransaction).not.toHaveBeenCalled();
  });

  it("refuses retry when the expense is not failed", async () => {
    db.getRow.mockResolvedValue({ ...expense, status: "approved" });

    const result = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });

    expect(result).toEqual({
      code: "not_failed",
      error: "Only failed bookings can be retried.",
      ok: false,
    });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("retry resets the claim, records booking_retried and posts", async () => {
    db.getRow.mockImplementation((_d: string, table: string) => {
      if (table === "user") {
        return Promise.resolve({ email: "t@example.test", name: "Student" });
      }
      const reset = db.updateRow.mock.calls.some(
        ([, t, , data]) => t === "expense" && data.status === "approved"
      );
      return Promise.resolve(
        reset
          ? expense
          : { ...expense, ledger_transaction_id: "posting", status: "failed" }
      );
    });

    const result = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });

    expect(db.updateRow).toHaveBeenNthCalledWith(1, "app", "expense", "exp-1", {
      ledger_transaction_id: null,
      posting_lock: 0,
      status: "approved",
    });
    const retried = db.createRow.mock.calls.find(
      ([, table, , data]) =>
        table === "expense_events" && data.action === "booking_retried"
    )?.[3];
    expect(retried).toMatchObject({
      actor_email: "it@biso.no",
      actor_kind: "admin",
      note: "retried from admin",
    });
    expect(finago.postExpenseTransaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, status: expect.any(String) });
  });

  it("returns the posting error and leaves booking_failed recorded", async () => {
    db.getRow.mockImplementation(async (_d: string, table: string) =>
      table === "user"
        ? { email: "t@example.test", name: "Student" }
        : {
            ...expense,
            ledger_transaction_id: db.updateRow.mock.calls.length
              ? null
              : "posting",
            status: db.updateRow.mock.calls.length ? "approved" : "failed",
          }
    );
    finago.postExpenseTransaction.mockRejectedValue(new Error("Finago down"));

    const result = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });

    expect(result).toEqual({
      code: "booking_failed",
      error: "Finago down",
      ok: false,
    });
    expect(eventActions()).toContain("booking_failed");
  });
});

describe("retry claim", () => {
  const failedRow = {
    ...expense,
    ledger_transaction_id: "posting",
    posting_lock: 1,
    status: "failed",
  };

  // The failed row until the retry resets it, the approved row after.
  const rowsAfterReset = (_d: string, table: string) => {
    if (table === "user") {
      return Promise.resolve({ email: "t@example.test", name: "Student" });
    }
    return Promise.resolve(
      db.updateRow.mock.calls.length > 0 ? expense : failedRow
    );
  };

  it("refuses when another retry took the increment", async () => {
    db.getRow.mockResolvedValue(failedRow);
    db.incrementRowColumn.mockResolvedValue({
      posting_lock: 3,
      status: "failed",
    });

    const result = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });

    expect(result).toMatchObject({ code: "retry_in_progress", ok: false });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(finago.postExpenseTransaction).not.toHaveBeenCalled();
  });

  it("refuses when a parallel retry already moved the status on", async () => {
    db.getRow.mockResolvedValue(failedRow);
    db.incrementRowColumn.mockResolvedValue({
      posting_lock: 2,
      status: "approved",
    });

    const result = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });

    expect(result).toMatchObject({ code: "retry_in_progress", ok: false });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(finago.postExpenseTransaction).not.toHaveBeenCalled();
  });

  it("lets the winner of the increment proceed", async () => {
    db.getRow.mockImplementation(rowsAfterReset);
    db.incrementRowColumn
      .mockResolvedValueOnce({ posting_lock: 2, status: "failed" })
      .mockResolvedValue({ posting_lock: 1, status: "approved" });

    const result = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });

    expect(result.ok).toBe(true);
    expect(db.incrementRowColumn.mock.calls[0]?.[0]).toMatchObject({
      column: "posting_lock",
      rowId: "exp-1",
      value: 1,
    });
    expect(finago.postExpenseTransaction).toHaveBeenCalledTimes(1);
  });

  it("reports status_write_failed when Finago booked but the status write failed", async () => {
    db.getRow.mockImplementation(rowsAfterReset);
    db.incrementRowColumn
      .mockResolvedValueOnce({ posting_lock: 2, status: "failed" })
      .mockResolvedValue({ posting_lock: 1, status: "approved" });
    db.updateRow.mockImplementation(
      (_d: string, table: string, _id: string, data: { status?: string }) =>
        table === "expense" && data.status === "success"
          ? Promise.reject(new Error("write failed"))
          : Promise.resolve({})
    );

    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      const pending = retryExpenseBooking({ actor: ACTOR, expenseId: "exp-1" });
      await vi.advanceTimersByTimeAsync(3000);
      expect(await pending).toMatchObject({
        code: "status_write_failed",
        ok: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("postApprovedExpense hardening", () => {
  it("success write waits between attempts", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    db.updateRow.mockImplementation(
      (_d: string, table: string, _id: string, data: object) => {
        if (table === "expense" && "status" in data) {
          const successWrites = db.updateRow.mock.calls.filter(
            ([, t, , d]) => t === "expense" && d.status === "success"
          ).length;
          if (successWrites <= 2) {
            return Promise.reject(new Error("write failed"));
          }
        }
        return Promise.resolve({});
      }
    );

    await postApprovedExpense("exp-1", { sleep });

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 2000]);
  });

  it("a todayInOslo throw records booking_failed", async () => {
    oslo.todayInOslo.mockImplementation(() => {
      throw new Error("no clock");
    });

    await expect(postApprovedExpense("exp-1")).rejects.toThrow("no clock");

    expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "exp-1", {
      status: "failed",
    });
    expect(eventActions()).toContain("booking_failed");
    expect(finago.postExpenseTransaction).not.toHaveBeenCalled();
  });
});
