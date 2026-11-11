import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  buildExpenseTransactionInput,
  buildShopReversalTransactionInput,
  buildShopTransactionInput,
  postWithClosedPeriodFallback,
} from "./transactions";

const NO_RECEIPTS_ERROR = /at least one receipt/i;
const UNBALANCED_VOUCHER_ERROR = /unbalanced voucher/i;
const EMPTY_VOUCHER_ERROR = /at least one revenue line/i;

describe("buildExpenseTransactionInput", () => {
  const base = {
    transactionTypeNumber: 5,
    supplierAccountNumber: 2400,
    date: "2026-06-25",
    bankAccount: "1234.56.78901",
    receipts: [
      { accountNumber: 7140, amount: 100.5, taxCode: 0 },
      { accountNumber: 7310, amount: 49.5 },
    ],
  };

  test("balances all lines to zero", () => {
    const input = buildExpenseTransactionInput(base);
    const sum = input.lines.reduce((acc, line) => acc + line.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(0);
  });

  test("debits each receipt to its cost account and credits supplier debt", () => {
    const input = buildExpenseTransactionInput(base);
    const debit = input.lines.filter((l) => l.amount > 0);
    const credit = input.lines.filter((l) => l.amount < 0);

    expect(debit.map((l) => l.accountNumber)).toEqual([7140, 7310]);
    expect(credit).toHaveLength(1);
    expect(credit[0].accountNumber).toBe(2400);
    expect(credit[0].amount).toBe(-150);
  });

  test("carries the recipient bank account on the supplier-debt line", () => {
    const input = buildExpenseTransactionInput(base);
    const credit = input.lines.find((l) => l.amount < 0);
    expect(credit?.invoice?.bankAccount).toBe("1234.56.78901");
  });

  test("applies dimensions to every line", () => {
    const dimensions = [
      { dimensionType: 2, value: "101" },
      { dimensionType: 101, value: "1" },
    ];
    const input = buildExpenseTransactionInput({ ...base, dimensions });
    for (const line of input.lines) {
      expect(line.dimensions).toEqual(dimensions);
    }
  });

  test("attaches the documentId when provided", () => {
    const input = buildExpenseTransactionInput({ ...base, documentId: 999 });
    expect(input.documentId).toBe(999);
  });

  test("throws when there are no receipts", () => {
    expect(() =>
      buildExpenseTransactionInput({ ...base, receipts: [] })
    ).toThrow(NO_RECEIPTS_ERROR);
  });

  test("dates each debit line with its receipt date and credits 2400 once per date", () => {
    const input = buildExpenseTransactionInput({
      ...base,
      receipts: [
        { accountNumber: 7140, amount: 100, date: "2026-08-14" },
        { accountNumber: 7140, amount: 200, date: "2026-10-02" },
        { accountNumber: 7140, amount: 50, date: "2026-08-14" },
      ],
    });
    const credits = input.lines.filter((l) => l.amount < 0);
    expect(credits.map((l) => [l.date, l.amount])).toEqual([
      ["2026-08-14", -150],
      ["2026-10-02", -200],
    ]);
    expect(
      credits.every((l) => l.invoice?.bankAccount === "1234.56.78901")
    ).toBe(true);
    expect(input.lines.filter((l) => l.amount > 0).map((l) => l.date)).toEqual([
      "2026-08-14",
      "2026-10-02",
      "2026-08-14",
    ]);
    expect(input.date).toBe("2026-10-02");
  });

  test("balances every date group to zero with øre amounts", () => {
    const input = buildExpenseTransactionInput({
      ...base,
      receipts: [
        { accountNumber: 7360, amount: 33.33, date: "2026-09-01" },
        { accountNumber: 7360, amount: 33.33, date: "2026-09-01" },
        { accountNumber: 7360, amount: 33.34, date: "2026-09-15" },
      ],
    });
    const byDate = new Map<string, number>();
    for (const line of input.lines) {
      const key = line.date ?? input.date;
      byDate.set(key, (byDate.get(key) ?? 0) + Math.round(line.amount * 100));
    }
    for (const cents of byDate.values()) {
      expect(cents).toBe(0);
    }
  });

  test("never sends the internal ref to Finago", () => {
    const input = buildExpenseTransactionInput({
      ...base,
      receipts: [{ accountNumber: 7140, amount: 10, ref: "att-1" }],
    });
    expect(JSON.stringify(input)).not.toContain("att-1");
  });
});

describe("buildShopTransactionInput", () => {
  const base = {
    campusId: "1",
    clearingAccount: 1530,
    comment: "Nettbutikk order-1",
    date: "2026-09-11",
    lines: [
      {
        accountNumber: 3000,
        amount: 490,
        comment: "Gensere til børsgruppen ×1",
        departmentId: "44",
        vatCode: 3,
      },
      { accountNumber: 3100, amount: 250, departmentId: "21", vatCode: 5 },
    ],
    total: 740,
    transactionTypeNumber: 8,
  };

  test("debits the clearing account by the gross total, with no dimensions", () => {
    const input = buildShopTransactionInput(base);
    expect(input.transactionTypeNumber).toBe(8);
    expect(input.date).toBe("2026-09-11");
    expect(input.lines[0]).toStrictEqual({
      accountNumber: 1530,
      amount: 740,
      comment: "Nettbutikk order-1",
      tax: { number: 0 },
    });
  });

  test("credits each revenue line with its VAT code, department and campus", () => {
    const input = buildShopTransactionInput(base);
    expect(input.lines[1]).toEqual({
      accountNumber: 3000,
      amount: -490,
      comment: "Gensere til børsgruppen ×1",
      dimensions: [
        { dimensionType: 2, value: "44" },
        { dimensionType: 101, value: "1" },
      ],
      tax: { number: 3 },
    });
    expect(input.lines[2]?.tax).toEqual({ number: 5 });
  });

  test("balances to zero", () => {
    const input = buildShopTransactionInput(base);
    const sum = input.lines.reduce((acc, line) => acc + line.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(0);
  });

  test("omits the campus dimension when the order has no campus", () => {
    const input = buildShopTransactionInput({ ...base, campusId: null });
    expect(input.lines[0]?.dimensions).toBeUndefined();
    expect(input.lines[1]?.dimensions).toEqual([
      { dimensionType: 2, value: "44" },
    ]);
  });

  test("refuses lines that do not cover the total", () => {
    expect(() => buildShopTransactionInput({ ...base, total: 999 })).toThrow(
      UNBALANCED_VOUCHER_ERROR
    );
  });

  test("refuses an empty voucher", () => {
    expect(() =>
      buildShopTransactionInput({ ...base, lines: [], total: 0 })
    ).toThrow(EMPTY_VOUCHER_ERROR);
  });
});

describe("buildShopReversalTransactionInput", () => {
  const base = {
    campusId: "1",
    clearingAccount: 1540,
    comment: "Refusjon nettbutikk order-1",
    date: "2026-09-12",
    lines: [
      { accountNumber: 3000, amount: 299, departmentId: "16", vatCode: 3 },
    ],
    total: 299,
    transactionTypeNumber: 8,
  };

  test("mirrors the sale with every sign flipped", () => {
    const sale = buildShopTransactionInput(base);
    const reversal = buildShopReversalTransactionInput(base);
    expect(reversal.lines.map((line) => line.amount)).toEqual(
      sale.lines.map((line) => -line.amount)
    );
  });

  test("keeps VAT codes and dimensions on revenue lines only", () => {
    const reversal = buildShopReversalTransactionInput(base);
    expect(reversal.lines[0]).toStrictEqual({
      accountNumber: 1540,
      amount: -299,
      comment: "Refusjon nettbutikk order-1",
      tax: { number: 0 },
    });
    expect(reversal.lines[1]).toEqual(
      expect.objectContaining({
        accountNumber: 3000,
        dimensions: [
          { dimensionType: 2, value: "16" },
          { dimensionType: 101, value: "1" },
        ],
        tax: { number: 3 },
      })
    );
  });

  test("refuses a reversal whose lines do not cover the refund", () => {
    expect(() =>
      buildShopReversalTransactionInput({ ...base, total: 300 })
    ).toThrow(UNBALANCED_VOUCHER_ERROR);
  });
});

describe("postWithClosedPeriodFallback", () => {
  const closed = new Error(
    '[Finago] post expense transaction failed: {"message":"Period is locked"}'
  );
  const periods = [
    { startingDate: "2026-09-01", endingDate: "2026-09-30" },
    { startingDate: "2026-10-01", endingDate: "2026-10-31" },
  ];

  let warn: ReturnType<typeof spyOn>;
  beforeEach(() => {
    warn = spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
  });

  test("skips a two-month closed period in one retry", async () => {
    const twoMonth = [
      { startingDate: "2024-01-01", endingDate: "2024-02-29" },
      { startingDate: "2024-03-01", endingDate: "2024-04-30" },
    ];
    const seen: string[][] = [];
    let calls = 0;
    const result = await postWithClosedPeriodFallback({
      receipts: [
        { accountNumber: 7140, amount: 10, date: "2024-03-10", ref: "x" },
      ],
      periods: twoMonth,
      post: (posted) => {
        seen.push(posted.map((r) => r.date ?? ""));
        calls += 1;
        return calls === 1 ? Promise.reject(closed) : Promise.resolve("tx-2");
      },
    });
    expect(seen).toEqual([["2024-03-10"], ["2024-05-01"]]);
    expect(result.shifts).toHaveLength(1);
    expect(result.shifts[0]).toMatchObject({
      from: "2024-03-10",
      to: "2024-05-01",
    });
  });

  test("merges shifted lines into the next group's date", async () => {
    const seen: string[][] = [];
    let calls = 0;
    const receipts = [
      { accountNumber: 7140, amount: 10, date: "2026-09-12", ref: "a" },
      { accountNumber: 7140, amount: 15, date: "2026-09-20", ref: "c" },
      { accountNumber: 7140, amount: 20, date: "2026-10-01", ref: "b" },
    ];
    const result = await postWithClosedPeriodFallback({
      receipts,
      periods,
      post: (posted) => {
        seen.push(posted.map((r) => r.date ?? ""));
        calls += 1;
        return calls === 1 ? Promise.reject(closed) : Promise.resolve("tx-1");
      },
    });
    expect(seen).toEqual([
      ["2026-09-12", "2026-09-20", "2026-10-01"],
      ["2026-10-01", "2026-10-01", "2026-10-01"],
    ]);
    expect(result).toEqual({
      transactionId: "tx-1",
      shifts: [
        {
          ref: "a",
          from: "2026-09-12",
          to: "2026-10-01",
          reason: "closed_period",
          finagoMessage: closed.message,
        },
        {
          ref: "c",
          from: "2026-09-20",
          to: "2026-10-01",
          reason: "closed_period",
          finagoMessage: closed.message,
        },
      ],
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(closed.message);
    // Caller's objects are untouched.
    expect(receipts[0].date).toBe("2026-09-12");
  });

  test("does not retry an unrelated error", async () => {
    let calls = 0;
    const failure = new Error(
      '[Finago] post expense transaction failed: {"message":"Account 9999 does not exist"}'
    );
    await expect(
      postWithClosedPeriodFallback({
        receipts: [{ accountNumber: 9999, amount: 10, date: "2026-10-03" }],
        periods,
        post: () => {
          calls += 1;
          return Promise.reject(failure);
        },
      })
    ).rejects.toBe(failure);
    expect(calls).toBe(1);
  });

  test("gives up after maxShifts", async () => {
    let calls = 0;
    await expect(
      postWithClosedPeriodFallback({
        receipts: [{ accountNumber: 7140, amount: 10, date: "2026-01-05" }],
        periods: [],
        maxShifts: 3,
        post: () => {
          calls += 1;
          return Promise.reject(closed);
        },
      })
    ).rejects.toBe(closed);
    expect(calls).toBe(4);
    expect(warn).toHaveBeenCalledTimes(3);
  });
});
