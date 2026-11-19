import { describe, expect, test } from "bun:test";
import {
  type ExpenseAttachments,
  ExpenseAttachmentsAccountSource,
  ExpenseAttachmentsProjectSource,
  ExpenseAttachmentsTypeSource,
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
  projects: new Map([
    ["p1", { active: true, name: "Fadderullan 2026" }],
    ["p2", { active: false, name: "Gamle Dager 2019" }],
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
      type_source: ExpenseAttachmentsTypeSource.APPROVER,
    });
    expect(plan.events).toEqual([
      { after: "office", before: "food", field: "cost_type" },
      { after: "6800", before: "7140", field: "account_number" },
    ]);
  });

  test("a type change by an admin records admin", () => {
    const plan = ok(
      planReceiptEdit(
        current(),
        { costType: "office" },
        ctx({ source: "admin" })
      )
    );
    expect(plan.patch.type_source).toBe(ExpenseAttachmentsTypeSource.ADMIN);
  });

  test("a legacy app receipt corrected by an approver teaches", () => {
    const plan = ok(
      planReceiptEdit(
        current({ type_source: ExpenseAttachmentsTypeSource.LEGACY_APP }),
        { costType: "office" },
        ctx()
      )
    );
    expect(plan.patch.type_source).toBe(ExpenseAttachmentsTypeSource.APPROVER);
  });

  test("an account-only edit does not mark the type as human-chosen", () => {
    const plan = ok(
      planReceiptEdit(
        current({ type_source: ExpenseAttachmentsTypeSource.LEGACY_APP }),
        { accountNumber: 7300 },
        ctx()
      )
    );
    expect(plan.patch).not.toHaveProperty("type_source");
    expect(plan.patch.account_source).toBe(
      ExpenseAttachmentsAccountSource.APPROVER
    );
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

  test("the current type is a no-op", () => {
    expect(planReceiptEdit(current(), { costType: "food" }, ctx())).toEqual({
      events: [],
      patch: {},
    });
  });

  test("errors are codes", () => {
    expect(planReceiptEdit(current(), { costType: "nope" }, ctx())).toEqual({
      error: "invalid_type",
    });
    expect(planReceiptEdit(current(), { amount: -1 }, ctx())).toEqual({
      error: "invalid_amount",
    });
    expect(planReceiptEdit(current(), { date: "2999-01-01" }, ctx())).toEqual({
      error: "invalid_date",
    });
    expect(planReceiptEdit(current(), { description: "" }, ctx())).toEqual({
      error: "invalid_description",
    });
    expect(planReceiptEdit(current(), { accountNumber: 7400 }, ctx())).toEqual({
      error: "invalid_account",
    });
    expect(
      planReceiptEdit(current({ amount: 0 }), { amount: 5 }, ctx())
    ).toEqual({ error: "supporting_receipt" });
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

  test("sets a project and records who chose it", () => {
    const plan = ok(planReceiptEdit(current(), { projectId: "p1" }, ctx()));
    expect(plan.patch).toEqual({
      project_confidence: null,
      project_id: "p1",
      project_name: "Fadderullan 2026",
      project_source: ExpenseAttachmentsProjectSource.APPROVER,
    });
    expect(plan.events).toEqual([
      { after: "Fadderullan 2026", before: null, field: "project" },
    ]);
    const asAdmin = ok(
      planReceiptEdit(current(), { projectId: "p1" }, ctx({ source: "admin" }))
    );
    expect(asAdmin.patch.project_source).toBe(
      ExpenseAttachmentsProjectSource.ADMIN
    );
  });

  test("refuses an inactive project", () => {
    expect(planReceiptEdit(current(), { projectId: "p2" }, ctx())).toEqual({
      error: "invalid_project",
    });
    expect(planReceiptEdit(current(), { projectId: "nope" }, ctx())).toEqual({
      error: "invalid_project",
    });
  });

  test("clearing the project logs before and after", () => {
    const plan = ok(
      planReceiptEdit(
        current({ project_id: "p1", project_name: "Fadderullan 2026" }),
        { projectId: null },
        ctx()
      )
    );
    expect(plan.patch).toEqual({
      project_confidence: null,
      project_id: null,
      project_name: null,
      project_source: ExpenseAttachmentsProjectSource.APPROVER,
    });
    expect(plan.events).toEqual([
      { after: null, before: "Fadderullan 2026", field: "project" },
    ]);
  });

  test("the same project changes and logs nothing", () => {
    const plan = ok(
      planReceiptEdit(
        current({ project_id: "p1", project_name: "Fadderullan 2026" }),
        { projectId: "p1" },
        ctx()
      )
    );
    expect(plan).toEqual({ events: [], patch: {} });
  });
});
