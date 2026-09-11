import { describe, expect, test } from "bun:test";
import {
  buildExpenseTransactionInput,
  buildShopReversalTransactionInput,
  buildShopTransactionInput,
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

  test("debits the clearing account by the gross total", () => {
    const input = buildShopTransactionInput(base);
    expect(input.transactionTypeNumber).toBe(8);
    expect(input.date).toBe("2026-09-11");
    expect(input.lines[0]).toEqual({
      accountNumber: 1530,
      amount: 740,
      comment: "Nettbutikk order-1",
      dimensions: [{ dimensionType: 101, value: "1" }],
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

  test("keeps VAT codes and dimensions", () => {
    const reversal = buildShopReversalTransactionInput(base);
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
