import { describe, expect, test } from "bun:test";
import { buildExpenseTransactionInput } from "./transactions";

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
    ).toThrow(/at least one receipt/i);
  });
});
