import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHOP_ACCOUNTING_SETTINGS } from "./finago-shop-accounting";
import {
  hasFinagoRestCredentials,
  loadShopAccountingSettings,
  resolveItemTargets,
  resolveRevenueTargetForProduct,
} from "./finago-shop-accounting-server";
import { getOrderItems } from "./order-parsing";

const ROWS: Record<string, Record<string, unknown>> = {
  "shop_settings/accounting": {
    general: JSON.stringify(DEFAULT_SHOP_ACCOUNTING_SETTINGS),
  },
  "webshop_products/p-sweater": { departmentId: "44", sales_type: "varesalg" },
  "webshop_products/p-trip": { departmentId: "21", sales_type: "egenandel" },
  "webshop_products/p-untyped": { departmentId: "21", sales_type: null },
  "webshop_products/p-locker": { departmentId: "1", sales_type: "bokskapleie" },
  "sales_types/varesalg": { account_number: 3000, active: true },
  "sales_types/egenandel": { account_number: 3100, active: false },
  "sales_types/bokskapleie": { account_number: 3620, active: true },
  "ledger_accounts/3000": { vat_code: 3 },
  "ledger_accounts/3100": { vat_code: 5 },
};

function fakeDb(rows: Record<string, Record<string, unknown>> = ROWS) {
  return {
    createRow: vi.fn(),
    deleteRow: vi.fn(),
    getRow: vi.fn((_db: string, table: string, id: string) => {
      const row = rows[`${table}/${id}`];
      return row
        ? Promise.resolve(row)
        : Promise.reject(
            Object.assign(new Error("row_not_found"), { code: 404 })
          );
    }),
    listRows: vi.fn(),
    updateRow: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadShopAccountingSettings", () => {
  it("reads the saved settings row", async () => {
    expect(await loadShopAccountingSettings(fakeDb())).toEqual(
      DEFAULT_SHOP_ACCOUNTING_SETTINGS
    );
  });

  it("returns null when nothing has been saved", async () => {
    expect(await loadShopAccountingSettings(fakeDb({}))).toBeNull();
  });

  it("throws when the read fails for a reason other than 404", async () => {
    const db = fakeDb();
    db.getRow.mockImplementation(() =>
      Promise.reject(
        Object.assign(new Error("Service unavailable"), { code: 503 })
      )
    );
    await expect(loadShopAccountingSettings(db)).rejects.toThrow(
      "Service unavailable"
    );
  });
});

describe("resolveRevenueTargetForProduct", () => {
  it("resolves account, VAT code and department from the sales type", async () => {
    expect(await resolveRevenueTargetForProduct(fakeDb(), "p-sweater")).toEqual(
      {
        accountNumber: 3000,
        departmentId: "44",
        vatCode: 3,
      }
    );
  });

  it("returns null for an inactive or missing sales type", async () => {
    const db = fakeDb();
    expect(await resolveRevenueTargetForProduct(db, "p-trip")).toBeNull();
    expect(await resolveRevenueTargetForProduct(db, "p-untyped")).toBeNull();
    expect(await resolveRevenueTargetForProduct(db, "unknown")).toBeNull();
  });

  it("returns null when the account has no synced VAT code", async () => {
    expect(
      await resolveRevenueTargetForProduct(fakeDb(), "p-locker")
    ).toBeNull();
  });
});

describe("resolveItemTargets", () => {
  it("prefers the checkout copy over the product's current sales type", async () => {
    const targets = await resolveItemTargets(fakeDb(), [
      {
        finago_account_number: 3100,
        finago_department: "1",
        finago_vat_code: 5,
        product_id: "p-sweater",
      },
    ]);
    expect(targets).toEqual([
      { accountNumber: 3100, departmentId: "1", vatCode: 5 },
    ]);
  });

  it("reads each product once when several lines share it", async () => {
    const db = fakeDb();
    const targets = await resolveItemTargets(db, [
      { product_id: "p-sweater" },
      { product_id: "p-sweater" },
      { product_id: null },
    ]);
    expect(targets).toEqual([
      { accountNumber: 3000, departmentId: "44", vatCode: 3 },
      { accountNumber: 3000, departmentId: "44", vatCode: 3 },
      null,
    ]);
    const productReads = db.getRow.mock.calls.filter(
      (call) => call[1] === "webshop_products"
    );
    expect(productReads).toHaveLength(1);
  });
});

describe("getOrderItems snapshot fields", () => {
  it("carries the ledger copy from relational order lines", () => {
    const [item] = getOrderItems({
      order_items: [
        {
          $id: "line-1",
          finago_account_number: 3000,
          finago_department: "44",
          finago_vat_code: 3,
          name: "Genser",
          quantity: 1,
          unit_price: 490,
        },
      ],
    });
    expect(item).toEqual(
      expect.objectContaining({
        finago_account_number: 3000,
        finago_department: "44",
        finago_vat_code: 3,
      })
    );
  });
});

describe("hasFinagoRestCredentials", () => {
  it("is true only when all three REST credentials are set", () => {
    vi.stubEnv("TFSO_REST_CLIENT_ID", "id");
    vi.stubEnv("TFSO_REST_CLIENT_SECRET", "secret");
    vi.stubEnv("TFSO_REST_ORG_ID", "org");
    expect(hasFinagoRestCredentials()).toBe(true);
    vi.stubEnv("TFSO_REST_ORG_ID", "");
    expect(hasFinagoRestCredentials()).toBe(false);
  });
});
