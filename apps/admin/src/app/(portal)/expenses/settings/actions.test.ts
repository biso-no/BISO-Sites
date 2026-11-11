import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

const ctx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "Admin",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  getUserAuthContext: mock(async () => ctx),
}));
mock.module("@/lib/finago/ledger-accounts-sync", () => ({
  syncLedgerAccounts: mock(async () => ({
    failed: 0,
    succeeded: 3,
    syncedAt: "2026-11-11T00:00:00.000Z",
  })),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("../../_actions/audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { getExpenseTypesView, saveExpenseType, seedStartingExpenseTypes } =
  await import("./actions");
const { STARTING_EXPENSE_COST_TYPES } = await import(
  "@repo/shared/utils/expense-cost-types"
);

const input = {
  accountNumber: 7140,
  active: true,
  askOccasion: false,
  description: null,
  label: "Møtemat",
  labelNo: "Møtemat",
  sortOrder: 3,
  taxCode: null,
};

const row = (data: Record<string, unknown>) => ({
  $id: "motemat",
  account_number: 7140,
  active: true,
  ask_occasion: false,
  campus_id: null,
  description: null,
  label: "Møtemat",
  label_no: "Møtemat",
  ocr_category: null,
  slug: "motemat",
  sort_order: 3,
  tax_code: 3,
  ...data,
});

function mockLedger(
  account: Record<string, unknown> | null,
  stored: Record<string, unknown> | null = null
) {
  db.getRow.mockImplementation((_d: string, table: string) => {
    if (table === "expense_cost_types" && stored) {
      return Promise.resolve(stored);
    }
    return table === "ledger_accounts" && account
      ? Promise.resolve(account)
      : Promise.reject(
          Object.assign(new Error("not found"), {
            code: 404,
            type: "row_not_found",
          })
        );
  });
}

beforeEach(() => {
  for (const fn of Object.values(db)) {
    fn.mockReset();
  }
  ctx.roles = ["globaladmin"];
  db.listRows.mockResolvedValue({ rows: [], total: 0 });
  db.createRow.mockImplementation(
    (_d: string, _t: string, id: string, data: Record<string, unknown>) =>
      Promise.resolve(row({ ...data, $id: id }))
  );
  db.updateRow.mockImplementation(
    (_d: string, _t: string, id: string, data: Record<string, unknown>) =>
      Promise.resolve(row({ ...data, $id: id }))
  );
});

describe("saveExpenseType", () => {
  test("creates a row with a generated slug", async () => {
    mockLedger({
      account_number: 7140,
      active: true,
      name: "Reise",
      tax_code: 3,
    });
    const result = await saveExpenseType(null, input);
    expect("data" in result).toBe(true);
    const [, , id, data] = db.createRow.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(id).toBe("motemat");
    expect(data.slug).toBe("motemat");
    expect(data.tax_code).toBe(3);
    expect(data.account_number).toBe(7140);
  });

  test("refuses an account that is not an active ledger account", async () => {
    mockLedger({
      account_number: 7140,
      active: false,
      name: "Reise",
      tax_code: 0,
    });
    const inactive = await saveExpenseType(null, input);
    expect("error" in inactive).toBe(true);
    mockLedger(null);
    const missing = await saveExpenseType(null, input);
    expect("error" in missing).toBe(true);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("never changes the slug on update", async () => {
    mockLedger(
      { account_number: 7140, active: true, name: "Reise", tax_code: 0 },
      row({ $id: "old-slug", slug: "old-slug" })
    );
    const result = await saveExpenseType("old-slug", {
      ...input,
      label: "Renamed",
    });
    expect("data" in result).toBe(true);
    const [, , id, data] = db.updateRow.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(id).toBe("old-slug");
    expect("slug" in data).toBe(false);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("keeps the tax code when editing other fields", async () => {
    mockLedger(
      { account_number: 7140, active: true, name: "Reise", tax_code: 0 },
      row({ account_number: 7140, tax_code: 3 })
    );
    await saveExpenseType("motemat", { ...input, label: "Renamed" });
    const data = db.updateRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(data.tax_code).toBe(3);
  });

  test("takes the new account's tax code when the account changes", async () => {
    mockLedger(
      { account_number: 7160, active: true, name: "Mat", tax_code: 1 },
      row({ account_number: 7140, tax_code: 3 })
    );
    await saveExpenseType("motemat", { ...input, accountNumber: 7160 });
    const data = db.updateRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(data.tax_code).toBe(1);
  });

  test("stores a tax code sent with the type", async () => {
    mockLedger(
      { account_number: 7140, active: true, name: "Reise", tax_code: 3 },
      row({ account_number: 7140, tax_code: 3 })
    );
    await saveExpenseType(null, { ...input, taxCode: 5 });
    const created = db.createRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(created.tax_code).toBe(5);

    await saveExpenseType("motemat", { ...input, taxCode: 0 });
    const updated = db.updateRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(updated.tax_code).toBe(0);
    // An explicit code needs no look at the stored row.
    expect(
      db.getRow.mock.calls.some(([, table]) => table === "expense_cost_types")
    ).toBe(false);
  });

  test("rejects a campus admin", async () => {
    ctx.roles = ["campusadmin"];
    const result = await saveExpenseType(null, input);
    expect("error" in result).toBe(true);
    expect(db.createRow).not.toHaveBeenCalled();
  });
});

describe("seedStartingExpenseTypes", () => {
  test("creates only the missing starting types", async () => {
    // The four types an earlier version of the admin created.
    const existing = ["travel", "social", "academic", "other"];
    db.listRows.mockResolvedValue({
      rows: existing.map((slug) => ({ $id: slug, slug })),
      total: existing.length,
    });
    const result = await seedStartingExpenseTypes();
    const total = STARTING_EXPENSE_COST_TYPES.length;
    expect(result).toEqual({
      data: { created: total - existing.length, skipped: existing.length },
    });
    const createdIds = db.createRow.mock.calls.map((call) => call[2]);
    expect(createdIds).toEqual(
      STARTING_EXPENSE_COST_TYPES.map((seed) => seed.slug).filter(
        (slug) => !existing.includes(slug)
      )
    );
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});

describe("getExpenseTypesView", () => {
  test("counts the starting types that have no row", async () => {
    db.listRows.mockImplementation((_d: string, table: string) =>
      Promise.resolve(
        table === "expense_cost_types"
          ? {
              rows: [
                row({ $id: "travel", slug: "travel" }),
                row({ $id: "motemat", slug: "motemat" }),
              ],
              total: 2,
            }
          : { rows: [], total: 0 }
      )
    );
    const view = await getExpenseTypesView();
    // "motemat" is not a starting slug, so only "travel" is in place.
    expect(view.missingStartingCount).toBe(
      STARTING_EXPENSE_COST_TYPES.length - 1
    );
    expect(view.types.map((type) => type.slug)).toEqual(["travel", "motemat"]);

    db.listRows.mockImplementation((_d: string, table: string) =>
      Promise.resolve(
        table === "expense_cost_types"
          ? {
              rows: STARTING_EXPENSE_COST_TYPES.map((seed) =>
                row({ $id: seed.slug, slug: seed.slug })
              ),
              total: STARTING_EXPENSE_COST_TYPES.length,
            }
          : { rows: [], total: 0 }
      )
    );
    expect((await getExpenseTypesView()).missingStartingCount).toBe(0);
  });
});
