import { STARTING_EXPENSE_COST_TYPES } from "@repo/shared/utils/expense-cost-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeCostTypes,
  loadActiveCostTypes,
  loadAllCostTypes,
  loadCostAccounts,
} from "./expense-types";

const listRows = vi.fn();
const db = { listRows } as unknown as Parameters<typeof loadAllCostTypes>[0];

function typeRow(over: Record<string, unknown>) {
  return {
    account_number: 7140,
    active: true,
    ask_occasion: false,
    description: null,
    label: "Row",
    label_no: null,
    ocr_category: null,
    slug: "row",
    sort_order: 0,
    tax_code: 0,
    ...over,
  };
}

function mockTables(tables: Record<string, unknown[]>) {
  listRows.mockImplementation(async (_db: string, table: string) => ({
    rows: tables[table] ?? [],
  }));
}

describe("expense types loaders", () => {
  beforeEach(() => listRows.mockReset());

  it("returns active types sorted by sort_order", async () => {
    mockTables({
      expense_cost_types: [
        typeRow({ label: "B", slug: "b", sort_order: 2, label_no: "Bb" }),
        typeRow({ label: "A", slug: "a", sort_order: 1, ask_occasion: true }),
        typeRow({ label: "Z", slug: "z", sort_order: 0, active: false }),
      ],
    });
    const result = await loadActiveCostTypes(db);
    expect(result.map((t) => t.slug)).toEqual(["a", "b"]);
    expect(result[0]?.askOccasion).toBe(true);
    expect(result[1]?.labelNo).toBe("Bb");
    expect(result[1]?.sortOrder).toBe(2);
  });

  it("activeCostTypes filters and sorts an already loaded list the same way", () => {
    const all = [
      { accountNumber: 1, label: "B", slug: "b", sortOrder: 1 },
      { accountNumber: 2, active: false, label: "Z", slug: "z", sortOrder: 0 },
      { accountNumber: 3, label: "C", slug: "c" },
      { accountNumber: 4, active: true, label: "A", slug: "a", sortOrder: 1 },
    ];
    expect(activeCostTypes(all).map((type) => type.slug)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("falls back to the starting list when the table is empty", async () => {
    mockTables({ expense_cost_types: [] });
    expect(await loadActiveCostTypes(db)).toEqual([
      ...STARTING_EXPENSE_COST_TYPES,
    ]);
    expect(await loadAllCostTypes(db)).toEqual([
      ...STARTING_EXPENSE_COST_TYPES,
    ]);
  });

  it("loadAllCostTypes keeps inactive rows", async () => {
    mockTables({
      expense_cost_types: [
        typeRow({ slug: "old", active: false }),
        typeRow({ slug: "new" }),
      ],
    });
    const result = await loadAllCostTypes(db);
    expect(result.map((t) => t.slug).sort()).toEqual(["new", "old"]);
  });

  it("loadCostAccounts keeps only active 4000-7999 accounts", async () => {
    mockTables({
      ledger_accounts: [
        { account_number: 7140, active: true, name: "Travel", tax_code: 1 },
        { account_number: 3000, active: true, name: "Revenue", tax_code: 0 },
        { account_number: 8000, active: true, name: "Fin", tax_code: 0 },
        { account_number: 4000, active: true, name: "Goods", tax_code: null },
        { account_number: 5000, active: false, name: "Off", tax_code: 0 },
      ],
    });
    expect(await loadCostAccounts(db)).toEqual([
      { accountNumber: 4000, name: "Goods", taxCode: 0 },
      { accountNumber: 7140, name: "Travel", taxCode: 1 },
    ]);
  });
});
