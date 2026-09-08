import { describe, expect, test } from "bun:test";
import {
  buildExpenseTransactionInput,
  buildShopRefundTransactionInput,
} from "./transactions";

const NO_RECEIPTS_ERROR = /at least one receipt/i;
const NO_REVENUE_ACCOUNTS_ERROR = /No revenue accounts resolved/i;

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

describe("buildShopRefundTransactionInput", () => {
  const base = {
    allocation: [
      { accountNumber: 3000, amountMinor: 49_900 },
      { accountNumber: 3010, amountMinor: 19_900 },
    ],
    amount: 698,
    date: "2026-09-08",
    orderId: "order-1",
    receivableAccountNumber: 1500,
    transactionTypeNumber: 7,
  };

  test("balances all lines to zero", () => {
    const input = buildShopRefundTransactionInput(base);
    const sum = input.lines.reduce((acc, line) => acc + line.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(0);
  });

  test("mirrors the original booking: revenue debited, receivable credited", () => {
    const input = buildShopRefundTransactionInput(base);
    const debit = input.lines.filter((l) => l.amount > 0);
    const credit = input.lines.filter((l) => l.amount < 0);

    expect(debit.map((l) => l.accountNumber)).toEqual([3000, 3010]);
    expect(debit.map((l) => l.amount)).toEqual([499, 199]);
    expect(credit).toHaveLength(1);
    expect(credit[0].accountNumber).toBe(1500);
    expect(credit[0].amount).toBe(-698);
  });

  test("credits the summed allocation, not the requested amount", () => {
    // A caller-supplied `amount` that disagrees with the allocation must not
    // unbalance the transaction — the allocation is the rounded truth.
    const input = buildShopRefundTransactionInput({ ...base, amount: 999 });
    const credit = input.lines.find((l) => l.amount < 0);
    expect(credit?.amount).toBe(-698);
  });

  test("applies the campus department dimension to every line", () => {
    const input = buildShopRefundTransactionInput({ ...base, campusId: "2" });
    for (const line of input.lines) {
      expect(line.dimensions).toEqual([{ type: 2, value: "301" }]);
    }
  });

  test("throws when no revenue account could be resolved", () => {
    expect(() =>
      buildShopRefundTransactionInput({ ...base, allocation: [] })
    ).toThrow(NO_REVENUE_ACCOUNTS_ERROR);
  });
});
