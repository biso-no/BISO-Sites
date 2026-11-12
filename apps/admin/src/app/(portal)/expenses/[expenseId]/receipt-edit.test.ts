import { describe, expect, test } from "bun:test";
import {
  type ExpenseAttachments,
  ExpenseAttachmentsAccountSource,
} from "@repo/api/types/appwrite";
import {
  type ExpenseTypeOption,
  planReceiptEdit,
  type ReceiptEditContext,
} from "./receipt-edit";

const current = (over: Partial<ExpenseAttachments> = {}) =>
  ({
    $id: "a1",
    account_number: 7140,
    account_source: "ai_freeform",
    amount: 200,
    cost_type: "food",
    cost_type_text: null,
    date: "2026-11-01T00:00:00.000Z",
    description: "Pizza",
    tax_code: 3,
    ...over,
  }) as ExpenseAttachments;

const types: ExpenseTypeOption[] = [
  {
    accountNumber: 7140,
    label: "Food",
    labelNo: "Mat",
    slug: "food",
    taxCode: 3,
  },
  {
    accountNumber: 6800,
    label: "Office",
    labelNo: "Kontor",
    slug: "office",
    taxCode: 1,
  },
];

const ctx = (over: Partial<ReceiptEditContext> = {}): ReceiptEditContext => ({
  accounts: new Map([
    [6800, { active: true, taxCode: 1 }],
    [7140, { active: true, taxCode: 3 }],
    [7300, { active: true, taxCode: null }],
    [7400, { active: false, taxCode: 3 }],
  ]),
  source: "approver",
  today: "2026-11-12",
  types,
  ...over,
});

const ok = (plan: ReturnType<typeof planReceiptEdit>) => {
  if ("error" in plan) {
    throw new Error(plan.error);
  }
  return plan;
};

describe("planReceiptEdit", () => {
  test("type change takes the type's account and tax code", () => {
    const plan = ok(planReceiptEdit(current(), { costType: "office" }, ctx()));
    expect(plan.patch).toEqual({
      account_number: 6800,
      account_source: ExpenseAttachmentsAccountSource.APPROVER,
      cost_type: "office",
      cost_type_text: null,
      tax_code: 1,
    });
    expect(plan.events).toEqual([
      { after: "office", before: "food", field: "cost_type" },
      { after: "6800", before: "7140", field: "account_number" },
    ]);
  });

  test("account change keeps the type and takes the account's tax code", () => {
    const plan = ok(
      planReceiptEdit(
        current(),
        { accountNumber: 7300 },
        ctx({ source: "admin" })
      )
    );
    expect(plan.patch).toEqual({
      account_number: 7300,
      account_source: ExpenseAttachmentsAccountSource.ADMIN,
      tax_code: null,
    });
    expect(plan.events).toEqual([
      { after: "7300", before: "7140", field: "account_number" },
    ]);
  });

  test("own text replaced by a type records the text as before", () => {
    const plan = ok(
      planReceiptEdit(
        current({ cost_type: null, cost_type_text: "Pizza night" }),
        { costType: "food" },
        ctx()
      )
    );
    expect(plan.events[0]).toEqual({
      after: "food",
      before: '"Pizza night"',
      field: "cost_type",
    });
    expect(plan.patch.cost_type_text).toBeNull();
  });

  test("inactive account refused", () => {
    expect(
      planReceiptEdit(current(), { accountNumber: 7400 }, ctx())
    ).toHaveProperty("error");
    expect(
      planReceiptEdit(current(), { accountNumber: 3000 }, ctx())
    ).toHaveProperty("error");
  });

  test("future date refused", () => {
    expect(
      planReceiptEdit(current(), { date: "2026-11-13" }, ctx())
    ).toHaveProperty("error");
    expect(
      planReceiptEdit(current(), { date: "1999-12-31" }, ctx())
    ).toHaveProperty("error");
    expect(
      planReceiptEdit(current(), { date: "2026-02-30" }, ctx())
    ).toHaveProperty("error");
  });

  test("date is stored as midnight UTC and logged as a day", () => {
    const plan = ok(planReceiptEdit(current(), { date: "2026-11-05" }, ctx()));
    expect(plan.patch.date).toBe("2026-11-05T00:00:00.000Z");
    expect(plan.events).toEqual([
      { after: "2026-11-05", before: "2026-11-01", field: "date" },
    ]);
  });

  test("amount rounds to two decimals", () => {
    const plan = ok(planReceiptEdit(current(), { amount: 12.345 }, ctx()));
    expect(plan.patch.amount).toBe(12.35);
    expect(plan.events).toEqual([
      { after: "12.35", before: "200", field: "amount" },
    ]);
    expect(planReceiptEdit(current(), { amount: 0 }, ctx())).toHaveProperty(
      "error"
    );
    expect(
      planReceiptEdit(current(), { amount: 1_000_001 }, ctx())
    ).toHaveProperty("error");
  });

  test("description is trimmed and bounded", () => {
    const plan = ok(
      planReceiptEdit(current(), { description: "  Lunch " }, ctx())
    );
    expect(plan.patch.description).toBe("Lunch");
    expect(
      planReceiptEdit(current(), { description: "   " }, ctx())
    ).toHaveProperty("error");
    expect(
      planReceiptEdit(current(), { description: "x".repeat(256) }, ctx())
    ).toHaveProperty("error");
  });

  test("unchanged fields produce no events", () => {
    const plan = ok(
      planReceiptEdit(
        current(),
        {
          accountNumber: 7140,
          amount: 200,
          costType: undefined,
          date: "2026-11-01",
          description: "Pizza",
        },
        ctx()
      )
    );
    expect(plan).toEqual({ events: [], patch: {} });
  });

  test("supporting statement refuses amount", () => {
    const statement = current({ amount: 0 });
    expect(planReceiptEdit(statement, { amount: 5 }, ctx())).toHaveProperty(
      "error"
    );
    expect(
      planReceiptEdit(statement, { costType: "food" }, ctx())
    ).toHaveProperty("error");
    const plan = ok(
      planReceiptEdit(statement, { description: "Bank statement" }, ctx())
    );
    expect(plan.patch).toEqual({ description: "Bank statement" });
  });
});
