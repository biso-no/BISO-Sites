import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = {
  getRow: mock(),
  listRows: mock(),
  upsertRow: mock(),
};

const ctx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  name: "Admin",
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
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
  syncLedgerAccounts: mock(async () => ({ failed: 0, succeeded: 0 })),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("../../_actions/audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { getAccountingView, saveSalesType } = await import("./actions");

const input = {
  account_number: 3100,
  active: true,
  label_en: "Personal contribution",
  label_no: "Egenandel",
  sort_order: 10,
};

function rowNotFound(): Error {
  return Object.assign(new Error("Row with the requested ID not found."), {
    code: 404,
    type: "row_not_found",
  });
}

function mockRows({
  account = { account_number: 3100, active: true, vat_code: 5 },
  liveProducts = 0,
  salesType = { $id: "egenandel", active: true },
}: {
  account?: Record<string, unknown> | null;
  liveProducts?: number;
  salesType?: Record<string, unknown> | null;
}) {
  db.getRow.mockImplementation((_databaseId: string, table: string) => {
    if (table === "ledger_accounts") {
      return account ? Promise.resolve(account) : Promise.reject(rowNotFound());
    }
    if (table === "sales_types") {
      return salesType
        ? Promise.resolve(salesType)
        : Promise.reject(rowNotFound());
    }
    return Promise.reject(new Error(`unexpected getRow(${table})`));
  });
  db.listRows.mockImplementation((_databaseId: string, table: string) => {
    if (table === "webshop_products") {
      return Promise.resolve({
        rows: liveProducts > 0 ? [{ $id: "product-1" }] : [],
        total: liveProducts,
      });
    }
    return Promise.resolve({ rows: [], total: 0 });
  });
  db.upsertRow.mockImplementation(
    (
      _databaseId: string,
      _table: string,
      id: string,
      data: Record<string, unknown>
    ) => Promise.resolve({ $id: id, ...data })
  );
}

beforeEach(() => {
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.upsertRow.mockReset();
});

describe("saveSalesType: accounts that would stop posting", () => {
  test("refuses an account without a synced VAT code", async () => {
    mockRows({
      account: { account_number: 3100, active: true, vat_code: null },
    });

    const result = await saveSalesType("egenandel", input);

    expect(result).toEqual({
      error:
        "Account 3100 has no VAT code yet — sync accounts from Finago first.",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("refuses an account that is inactive in Finago", async () => {
    mockRows({ account: { account_number: 3100, active: false, vat_code: 5 } });

    const result = await saveSalesType("egenandel", input);

    expect(result).toEqual({
      error: "Account 3100 is inactive in Finago. Choose an active account.",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("saves a sales type on an active account with a VAT code", async () => {
    mockRows({});

    const result = await saveSalesType("egenandel", input);

    expect("data" in result).toBe(true);
    expect(db.upsertRow).toHaveBeenCalledTimes(1);
  });
});

describe("saveSalesType: deactivating a sales type live products use", () => {
  test("refuses while published or pending products still use it", async () => {
    mockRows({ liveProducts: 2 });

    const result = await saveSalesType("egenandel", {
      ...input,
      active: false,
    });

    expect(result).toEqual({
      error:
        "2 live products use this sales type — move them to another sales type before deactivating it.",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
    const queries = db.listRows.mock.calls.find(
      (call) => call[1] === "webshop_products"
    )?.[2] as string[];
    expect(queries).toContain(Query.equal("sales_type", "egenandel"));
    expect(queries).toContain(
      Query.equal("status", ["published", "pending_approval"])
    );
  });

  test("deactivates when no live product uses it", async () => {
    mockRows({ liveProducts: 0 });

    const result = await saveSalesType("egenandel", {
      ...input,
      active: false,
    });

    expect("data" in result).toBe(true);
    expect(db.upsertRow).toHaveBeenCalledTimes(1);
  });

  test("does not count products when the sales type is already inactive", async () => {
    mockRows({
      liveProducts: 2,
      salesType: { $id: "egenandel", active: false },
    });

    const result = await saveSalesType("egenandel", {
      ...input,
      active: false,
      label_en: "Renamed",
    });

    expect("data" in result).toBe(true);
    expect(
      db.listRows.mock.calls.some((call) => call[1] === "webshop_products")
    ).toBe(false);
  });

  test("does not count products when saving an active sales type", async () => {
    mockRows({ liveProducts: 2 });

    const result = await saveSalesType("egenandel", input);

    expect("data" in result).toBe(true);
    expect(
      db.listRows.mock.calls.some((call) => call[1] === "webshop_products")
    ).toBe(false);
  });
});

describe("getAccountingView", () => {
  test("reads only revenue accounts so they always fit within the limit", async () => {
    mockRows({});

    await getAccountingView();

    const queries = db.listRows.mock.calls.find(
      (call) => call[1] === "ledger_accounts"
    )?.[2] as string[];
    expect(queries).toContain(Query.between("account_number", 3000, 3999));
  });
});
