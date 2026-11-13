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
// The payee lookup calls Finago; every test books on one known customer.
const payee = vi.hoisted(() => ({
  resolveReimbursementCustomer: vi.fn(async () => ({
    bankAccountAdded: false,
    created: false,
    customerId: 4992,
  })),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db, storage })),
}));
vi.mock("@repo/connectors/24sevenoffice", async () => {
  const actual = await vi.importActual<
    typeof import("@repo/connectors/24sevenoffice")
  >("@repo/connectors/24sevenoffice");
  return { ...actual, ...finago, ...payee };
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

  it("retry claims, marks the row approved, records booking_retried and posts", async () => {
    db.getRow.mockImplementation((_d: string, table: string) => {
      if (table === "user") {
        return Promise.resolve({ email: "t@example.test", name: "Student" });
      }
      const reset = db.updateRow.mock.calls.some(
        ([, t, , data]) => t === "expense" && data.status === "approved"
      );
      return Promise.resolve(
        reset
          ? { ...expense, posting_lock: 1 }
          : { ...expense, ledger_transaction_id: "posting", status: "failed" }
      );
    });

    const result = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });

    expect(db.updateRow).toHaveBeenNthCalledWith(1, "app", "expense", "exp-1", {
      ledger_transaction_id: "posting",
      status: "approved",
    });
    // The lock only grows: a retry never resets it.
    expect(
      db.updateRow.mock.calls.some(([, , , data]) => "posting_lock" in data)
    ).toBe(false);
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
            posting_lock: db.updateRow.mock.calls.length ? 1 : 0,
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
      db.updateRow.mock.calls.length > 0
        ? { ...expense, posting_lock: 2 }
        : failedRow
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

describe("retry claim races", () => {
  // A row that behaves like Appwrite: atomic increments, merged updates.
  function fakeRow(initial: Record<string, unknown>) {
    const row: Record<string, unknown> = { ...expense, ...initial };
    db.getRow.mockImplementation((_d: string, table: string) =>
      Promise.resolve(
        table === "user"
          ? { email: "t@example.test", name: "Student" }
          : { ...row }
      )
    );
    db.incrementRowColumn.mockImplementation(
      (arg: { column: string; value: number }) => {
        row[arg.column] = ((row[arg.column] as number) ?? 0) + arg.value;
        return Promise.resolve({ ...row });
      }
    );
    db.updateRow.mockImplementation(
      (_d: string, _t: string, _id: string, data: Record<string, unknown>) => {
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      }
    );
    return row;
  }
  const failed = {
    ledger_transaction_id: "posting",
    posting_lock: 1,
    status: "failed",
  };

  it("posts exactly once when a loser increments right after the winner's re-read", async () => {
    const row = fakeRow(failed);
    // The loser read the failed row before the winner wrote anything, but its
    // increment only lands once the winner has marked the row approved.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let increments = 0;
    db.incrementRowColumn.mockImplementation(
      async (arg: { column: string; value: number }) => {
        increments += 1;
        if (increments === 2) {
          await gate;
        }
        row[arg.column] = ((row[arg.column] as number) ?? 0) + arg.value;
        return { ...row };
      }
    );
    // The winner's re-read of posting_lock follows its approved write; the loser's
    // increment lands right after that re-read, before the winner posts.
    const read = db.getRow.getMockImplementation();
    db.getRow.mockImplementation((...args: unknown[]) => {
      const result = read?.(...args);
      if (
        String(args[3]).includes("posting_lock") &&
        row.status === "approved"
      ) {
        release();
      }
      return result;
    });

    const [first, second] = await Promise.all([
      retryExpenseBooking({ actor: ACTOR, expenseId: "exp-1" }),
      retryExpenseBooking({ actor: ACTOR, expenseId: "exp-1" }),
    ]);

    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ code: "retry_in_progress", ok: false });
    expect(finago.postExpenseTransaction).toHaveBeenCalledTimes(1);
    expect(row.status).toBe("success");
    expect(row.ledger_transaction_id).toBe("tx-1");
  });

  it("posts once when both retries increment before either writes", async () => {
    const row = fakeRow(failed);
    // A claims lock 2 and stalls before its approved write. B reads the row
    // (lock 2, failed) and increments to 3 while the status is still failed.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const increment = db.incrementRowColumn.getMockImplementation();
    db.incrementRowColumn.mockImplementation(async (arg: unknown) => {
      const result = await increment?.(arg);
      if (row.posting_lock === 3) {
        release();
      }
      return result;
    });
    const write = db.updateRow.getMockImplementation();
    let writes = 0;
    db.updateRow.mockImplementation(async (...args: unknown[]) => {
      if ((args[3] as { status?: string }).status === "approved") {
        writes += 1;
        if (writes === 1) {
          await gate;
        }
      }
      return await write?.(...args);
    });

    const a = retryExpenseBooking({ actor: ACTOR, expenseId: "exp-1" });
    while (row.posting_lock !== 2) {
      await Promise.resolve();
    }
    const b = retryExpenseBooking({ actor: ACTOR, expenseId: "exp-1" });
    const [first, second] = await Promise.all([a, b]);

    expect(first).toMatchObject({ code: "retry_in_progress", ok: false });
    expect(second).toEqual({ ok: true, status: "success" });
    expect(finago.postExpenseTransaction).toHaveBeenCalledTimes(1);
    expect(row.status).toBe("success");
    const retried = db.createRow.mock.calls.filter(
      ([, table, , data]) =>
        table === "expense_events" && data.action === "booking_retried"
    );
    expect(retried).toHaveLength(1);
  });

  it("selects posting_lock so the claim can compare against it", async () => {
    fakeRow(failed);

    await retryExpenseBooking({ actor: ACTOR, expenseId: "exp-1" });

    const query = db.getRow.mock.calls.find(
      ([, table]) => table === "expense"
    )?.[3] as string[];
    expect(query.join(" ")).toContain("posting_lock");
  });

  it("lets a second retry proceed after the first post failed", async () => {
    const row = fakeRow(failed);
    finago.postExpenseTransaction.mockRejectedValueOnce(
      new Error("Finago down")
    );

    const first = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });
    expect(first).toMatchObject({ code: "booking_failed", ok: false });
    expect(row.status).toBe("failed");
    expect(row.posting_lock).toBe(2);

    const second = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });
    expect(second).toEqual({ ok: true, status: "success" });
    expect(row.posting_lock).toBe(3);
    expect(finago.postExpenseTransaction).toHaveBeenCalledTimes(2);
  });

  it("refuses when a booked event exists and writes nothing", async () => {
    fakeRow(failed);
    db.listRows.mockImplementation((_d: string, table: string) =>
      Promise.resolve({
        rows:
          table === "expense_events"
            ? [{ action: "booked", note: "tx-55 (status write failed: x)" }]
            : [],
      })
    );

    const result = await retryExpenseBooking({
      actor: ACTOR,
      expenseId: "exp-1",
    });

    expect(result).toEqual({
      code: "already_booked",
      error: "Already booked as tx-55.",
      ok: false,
    });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
    const query = db.listRows.mock.calls[0]?.[2] as string[];
    expect(query.join(" ")).toContain("booked");
  });
});

describe("postApprovedExpense hardening", () => {
  it("skips an expense that is no longer approved without claiming it", async () => {
    for (const status of ["failed", "success", "pending"]) {
      db.getRow.mockImplementation((_d: string, table: string) =>
        Promise.resolve(
          table === "user"
            ? { email: "t@example.test", name: "Student" }
            : { ...expense, status }
        )
      );

      await postApprovedExpense("exp-1");
    }

    expect(db.incrementRowColumn).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(finago.postExpenseTransaction).not.toHaveBeenCalled();
  });

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
