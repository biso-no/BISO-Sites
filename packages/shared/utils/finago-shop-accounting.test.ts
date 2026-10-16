import { describe, expect, it } from "vitest";
import {
  clearingProvider,
  DEFAULT_SHOP_ACCOUNTING_SETTINGS,
  ledgerDate,
  parseShopAccountingSettings,
  type RevenueTarget,
  resolveShopPosting,
  revenueTargetKey,
  SEED_SALES_TYPES,
  snapshotTarget,
} from "./finago-shop-accounting";

const SWEATER: RevenueTarget = {
  accountNumber: 3000,
  departmentId: "44",
  vatCode: 3,
};
const TRIP: RevenueTarget = {
  accountNumber: 3100,
  departmentId: "21",
  vatCode: 5,
};

describe("parseShopAccountingSettings", () => {
  it("reads saved settings", () => {
    expect(
      parseShopAccountingSettings(
        JSON.stringify(DEFAULT_SHOP_ACCOUNTING_SETTINGS)
      )
    ).toEqual({
      clearingAccounts: { stripe: 1540, vipps: 1530 },
      transactionTypeNumber: 8,
    });
  });

  it("rejects missing, malformed and out-of-range settings", () => {
    expect(parseShopAccountingSettings(null)).toBeNull();
    expect(parseShopAccountingSettings("{not json")).toBeNull();
    expect(
      parseShopAccountingSettings(
        JSON.stringify({
          clearingAccounts: { stripe: 1540, vipps: 99 },
          transactionTypeNumber: 8,
        })
      )
    ).toBeNull();
  });
});

describe("clearingProvider", () => {
  it("normalises the providers that have a clearing account", () => {
    expect(clearingProvider("Vipps")).toBe("vipps");
    expect(clearingProvider("stripe")).toBe("stripe");
  });

  it("returns null for anything else", () => {
    expect(clearingProvider("Nets Easy")).toBeNull();
    expect(clearingProvider(null)).toBeNull();
  });
});

describe("snapshotTarget", () => {
  it("reads a complete copy from an order line", () => {
    expect(
      snapshotTarget({
        finago_account_number: 3000,
        finago_department: "44",
        finago_vat_code: 3,
      })
    ).toEqual(SWEATER);
  });

  it("ignores an incomplete copy", () => {
    expect(
      snapshotTarget({ finago_account_number: 3000, finago_department: "44" })
    ).toBeNull();
    expect(
      snapshotTarget({
        finago_account_number: 3000,
        finago_department: "",
        finago_vat_code: 3,
      })
    ).toBeNull();
  });
});

describe("resolveShopPosting", () => {
  const base = {
    campusId: "1",
    provider: "vipps",
    settings: DEFAULT_SHOP_ACCOUNTING_SETTINGS,
  };

  it("debits the Vipps clearing account and credits the sales type's account", () => {
    const result = resolveShopPosting({
      ...base,
      items: [
        {
          name: "Gensere til børsgruppen",
          quantity: 1,
          target: SWEATER,
          unitPrice: 490,
        },
      ],
      total: 490,
    });

    expect(result).toEqual({
      ok: true,
      posting: {
        campusId: "1",
        clearingAccount: 1530,
        lines: [
          {
            ...SWEATER,
            amount: 490,
            comment: "Gensere til børsgruppen ×1",
          },
        ],
        total: 490,
        transactionTypeNumber: 8,
      },
    });
  });

  it("groups lines that share a target and keeps other targets apart", () => {
    const result = resolveShopPosting({
      ...base,
      items: [
        { name: "Genser S", quantity: 2, target: SWEATER, unitPrice: 299 },
        { name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 },
        { name: "Genser M", quantity: 1, target: SWEATER, unitPrice: 299 },
      ],
      total: 1397,
    });

    expect(result.ok && result.posting.lines).toEqual([
      { ...SWEATER, amount: 897, comment: "Genser S ×2, Genser M ×1" },
      { ...TRIP, amount: 500, comment: "Hyttetur ×1" },
    ]);
  });

  it("uses the Stripe clearing account for a Stripe order", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 }],
      provider: "stripe",
      total: 500,
    });
    expect(result.ok && result.posting.clearingAccount).toBe(1540);
  });

  it("ignores free lines", () => {
    const result = resolveShopPosting({
      ...base,
      items: [
        { name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 },
        { name: "Gratis genser", quantity: 1, target: null, unitPrice: 0 },
      ],
      total: 500,
    });
    expect(result.ok && result.posting.lines).toHaveLength(1);
  });

  it("refuses without saved settings", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 }],
      settings: null,
      total: 500,
    });
    expect(result).toEqual({
      ok: false,
      reason: "Shop accounting settings have not been saved in admin",
    });
  });

  it("refuses a provider with no clearing account", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 }],
      provider: "Nets Easy",
      total: 500,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'No clearing account for payment provider "Nets Easy"',
    });
  });

  it("refuses a priced line without a sales type", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Hoodie", quantity: 1, target: null, unitPrice: 400 }],
      total: 400,
    });
    expect(result).toEqual({ ok: false, reason: '"Hoodie" has no sales type' });
  });

  it("refuses an order with no priced lines", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Gratis", quantity: 1, target: TRIP, unitPrice: 0 }],
      total: 0,
    });
    expect(result).toEqual({
      ok: false,
      reason: "The order has no priced lines",
    });
  });

  it("refuses lines that do not add up to the order total", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 }],
      total: 450,
    });
    expect(result).toEqual({
      ok: false,
      reason: "Order lines sum to 500 kr but the order total is 450 kr",
    });
  });
});

describe("revenueTargetKey", () => {
  it("distinguishes the same account in different departments", () => {
    expect(revenueTargetKey(SWEATER)).not.toBe(
      revenueTargetKey({ ...SWEATER, departmentId: "16" })
    );
  });
});

describe("ledgerDate", () => {
  it("uses the Oslo calendar day", () => {
    expect(ledgerDate(new Date("2026-09-10T22:30:00Z"))).toBe("2026-09-11");
    expect(ledgerDate(new Date("2026-01-15T12:00:00Z"))).toBe("2026-01-15");
  });
});

describe("SEED_SALES_TYPES", () => {
  it("seeds the four approved sales types with unique ids", () => {
    expect(SEED_SALES_TYPES.map((type) => type.account_number)).toEqual([
      3100, 3000, 3620, 3150,
    ]);
    expect(new Set(SEED_SALES_TYPES.map((type) => type.$id)).size).toBe(4);
  });
});
