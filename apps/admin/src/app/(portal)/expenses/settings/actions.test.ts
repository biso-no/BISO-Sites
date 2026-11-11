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

const { saveExpenseType, seedStartingExpenseTypes } = await import("./actions");
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

  test("rejects a campus admin", async () => {
    ctx.roles = ["campusadmin"];
    const result = await saveExpenseType(null, input);
    expect("error" in result).toBe(true);
    expect(db.createRow).not.toHaveBeenCalled();
  });
});

describe("seedStartingExpenseTypes", () => {
  test("skips existing slugs", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ $id: "travel", slug: "travel" }],
      total: 1,
    });
    const result = await seedStartingExpenseTypes();
    const total = STARTING_EXPENSE_COST_TYPES.length;
    expect(result).toEqual({ data: { created: total - 1, skipped: 1 } });
    expect(db.createRow).toHaveBeenCalledTimes(total - 1);
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});
