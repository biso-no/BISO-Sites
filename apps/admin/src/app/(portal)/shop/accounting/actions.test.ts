import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
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

const {
  getAccountingView,
  saveSalesType,
  saveShopAccountingSettings,
  setShopLedgerPosting,
} = await import("./actions");

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
  db.createRow.mockReset();
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
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

describe("setShopLedgerPosting: switching on only when the setup can post", () => {
  const SAVED_SETTINGS = {
    general: JSON.stringify({
      clearingAccounts: { stripe: 1540, vipps: 1530 },
      transactionTypeNumber: 8,
    }),
  };
  const GOOD_CHART: Record<string, Record<string, unknown>> = {
    "1530": { account_number: 1530, active: true, vat_code: null },
    "1540": { account_number: 1540, active: true, vat_code: null },
    "3000": { account_number: 3000, active: true, vat_code: 3 },
  };

  function mockPostingSetup({
    accountReadError,
    chart = GOOD_CHART,
    postingOn = false,
    salesTypesTotal,
    salesTypes = [
      {
        $id: "varesalg",
        account_number: 3000,
        active: true,
        label_no: "Varesalg",
      },
    ],
  }: {
    accountReadError?: Error;
    chart?: Record<string, Record<string, unknown>>;
    postingOn?: boolean;
    salesTypes?: Record<string, unknown>[];
    salesTypesTotal?: number;
  }) {
    db.getRow.mockImplementation(
      (_databaseId: string, table: string, id: string) => {
        if (table === "shop_settings") {
          return Promise.resolve(SAVED_SETTINGS);
        }
        if (table === "ledger_accounts" && accountReadError) {
          return Promise.reject(accountReadError);
        }
        if (table === "ledger_accounts" && chart[id]) {
          return Promise.resolve(chart[id]);
        }
        return Promise.reject(rowNotFound());
      }
    );
    db.listRows.mockImplementation((_databaseId: string, table: string) => {
      if (table === "sales_types") {
        return Promise.resolve({
          rows: salesTypes,
          total: salesTypesTotal ?? salesTypes.length,
        });
      }
      if (table === "feature_flags" && postingOn) {
        return Promise.resolve({
          rows: [{ $id: "flag-1", enabled: true, key: "shop_ledger_posting" }],
          total: 1,
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
    db.createRow.mockImplementation(
      (
        _databaseId: string,
        _table: string,
        id: string,
        data: Record<string, unknown>
      ) => Promise.resolve({ $id: id, ...data })
    );
  }

  test("refuses when an active sales type's account has no VAT code", async () => {
    mockPostingSetup({
      chart: {
        ...GOOD_CHART,
        "3000": { account_number: 3000, active: true, vat_code: null },
      },
    });

    const result = await setShopLedgerPosting(true);

    expect(result).toEqual({
      error: expect.stringContaining("Varesalg (3000) has no VAT code"),
    });
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("checks every active sales type, not just the first", async () => {
    mockPostingSetup({
      salesTypes: [
        {
          $id: "varesalg",
          account_number: 3000,
          active: true,
          label_no: "Varesalg",
        },
        {
          $id: "egenandel",
          account_number: 3100,
          active: true,
          label_no: "Egenandel",
        },
      ],
    });

    const result = await setShopLedgerPosting(true);

    expect(result).toEqual({
      error: expect.stringContaining("Egenandel (3100)"),
    });
    const salesTypeQueries = db.listRows.mock.calls.find(
      (call) => call[1] === "sales_types"
    )?.[2] as string[];
    expect(salesTypeQueries).not.toContain(Query.limit(1));
  });

  test("refuses when a clearing account is not in the synced chart", async () => {
    const { "1540": _stripe, ...withoutStripe } = GOOD_CHART;
    mockPostingSetup({ chart: withoutStripe });

    const result = await setShopLedgerPosting(true);

    expect(result).toEqual({
      error: expect.stringContaining("Stripe clearing account 1540"),
    });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("switches posting on when every account can post", async () => {
    mockPostingSetup({});

    const result = await setShopLedgerPosting(true);

    expect(result).toEqual({ data: { enabled: true } });
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "feature_flags",
      expect.any(String),
      expect.objectContaining({ enabled: true, key: "shop_ledger_posting" })
    );
  });

  test("refuses when there are more active sales types than one read returns", async () => {
    mockPostingSetup({ salesTypesTotal: 150 });

    const result = await setShopLedgerPosting(true);

    expect(result).toEqual({
      error: expect.stringContaining("150 active sales types"),
    });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("asks to try again when a ledger account read fails for a reason other than not found", async () => {
    mockPostingSetup({ accountReadError: new Error("fetch failed") });

    const result = await setShopLedgerPosting(true);

    expect(result).toEqual({
      error: "Could not read ledger accounts — try again",
    });
    expect(db.createRow).not.toHaveBeenCalled();
  });

  test("switches posting off without checking accounts", async () => {
    mockPostingSetup({ chart: {} });

    const result = await setShopLedgerPosting(false);

    expect(result).toEqual({ data: { enabled: false } });
    expect(
      db.getRow.mock.calls.some((call) => call[1] === "ledger_accounts")
    ).toBe(false);
  });
});

describe("saveShopAccountingSettings: clearing accounts", () => {
  const input = {
    clearingAccounts: { stripe: 1540, vipps: 1539 },
    transactionTypeNumber: 8,
  };

  function mockSettingsSave({
    chart,
    postingOn,
  }: {
    chart: Record<string, Record<string, unknown>>;
    postingOn: boolean;
  }) {
    db.getRow.mockImplementation(
      (_databaseId: string, table: string, id: string) => {
        if (table === "ledger_accounts" && chart[id]) {
          return Promise.resolve(chart[id]);
        }
        return Promise.reject(rowNotFound());
      }
    );
    db.listRows.mockImplementation((_databaseId: string, table: string) =>
      Promise.resolve(
        table === "feature_flags" && postingOn
          ? {
              rows: [{ $id: "f", enabled: true, key: "shop_ledger_posting" }],
              total: 1,
            }
          : { rows: [], total: 0 }
      )
    );
    db.upsertRow.mockImplementation(
      (
        _databaseId: string,
        _table: string,
        id: string,
        data: Record<string, unknown>
      ) => Promise.resolve({ $id: id, ...data })
    );
  }

  test("refuses a mistyped clearing account while posting is on", async () => {
    mockSettingsSave({
      chart: { "1540": { account_number: 1540, active: true } },
      postingOn: true,
    });

    const result = await saveShopAccountingSettings(input);

    expect(result).toEqual({
      error: expect.stringContaining(
        "Vipps clearing account 1539 is not in the synced chart of accounts"
      ),
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("saves synced, active clearing accounts while posting is on", async () => {
    mockSettingsSave({
      chart: {
        "1539": { account_number: 1539, active: true },
        "1540": { account_number: 1540, active: true },
      },
      postingOn: true,
    });

    const result = await saveShopAccountingSettings(input);

    expect(result).toEqual({ data: input });
    expect(db.upsertRow).toHaveBeenCalled();
  });

  test("saves without the chart check while posting is off, so settings can precede the first sync", async () => {
    mockSettingsSave({ chart: {}, postingOn: false });

    const result = await saveShopAccountingSettings(input);

    expect(result).toEqual({ data: input });
  });
});
