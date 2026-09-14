import { describe, expect, test } from "bun:test";
import {
  revenueAccountOptions,
  SALES_TYPE_ID_RE,
  salesTypeIdFromLabel,
  salesTypeInputSchema,
  settingsOrDefault,
  vatKind,
} from "./accounting-model";

describe("salesTypeInputSchema", () => {
  test("accepts a revenue account with both labels", () => {
    const parsed = salesTypeInputSchema.safeParse({
      account_number: "3100",
      active: true,
      label_en: " Personal contribution ",
      label_no: "Egenandel",
      sort_order: "10",
    });
    expect(parsed.success && parsed.data).toEqual({
      account_number: 3100,
      active: true,
      label_en: "Personal contribution",
      label_no: "Egenandel",
      sort_order: 10,
    });
  });

  test("rejects a non-revenue account and empty labels", () => {
    expect(
      salesTypeInputSchema.safeParse({
        account_number: 7310,
        active: true,
        label_en: "Social event",
        label_no: "Sosialt",
        sort_order: 0,
      }).success
    ).toBe(false);
    expect(
      salesTypeInputSchema.safeParse({
        account_number: 3100,
        active: true,
        label_en: "",
        label_no: "Egenandel",
        sort_order: 0,
      }).success
    ).toBe(false);
  });
});

describe("salesTypeIdFromLabel", () => {
  test("turns a Norwegian label into a stable row id", () => {
    const id = salesTypeIdFromLabel("Varesalg – klær og merch (25 % mva)");
    expect(id).toBe("varesalg-klaer-og-merch-25-mva");
    expect(SALES_TYPE_ID_RE.test(id)).toBe(true);
    expect(salesTypeIdFromLabel("Bøter på tur")).toBe("boter-pa-tur");
  });
});

describe("settingsOrDefault", () => {
  test("marks saved settings as saved", () => {
    const general = JSON.stringify({
      clearingAccounts: { stripe: 1540, vipps: 1530 },
      transactionTypeNumber: 8,
    });
    expect(settingsOrDefault(general).saved).toBe(true);
  });

  test("pre-fills the ledger's current accounts when nothing is saved", () => {
    expect(settingsOrDefault(null)).toEqual({
      saved: false,
      settings: {
        clearingAccounts: { stripe: 1540, vipps: 1530 },
        transactionTypeNumber: 8,
      },
    });
  });
});

describe("revenueAccountOptions", () => {
  test("keeps active 3xxx accounts, sorted, with their VAT number", () => {
    expect(
      revenueAccountOptions([
        {
          account_number: 3100,
          active: true,
          name: "Egenandeler",
          vat_code: 5,
        },
        { account_number: 1530, active: true, name: "Vipps", vat_code: 0 },
        { account_number: 3000, active: true, name: "Salg", vat_code: 3 },
        { account_number: 3040, active: false, name: "Øl", vat_code: 3 },
      ])
    ).toEqual([
      { accountNumber: 3000, name: "Salg", vatCode: 3 },
      { accountNumber: 3100, name: "Egenandeler", vatCode: 5 },
    ]);
  });
});

describe("vatKind", () => {
  test("names the VAT numbers the webshop uses", () => {
    expect(vatKind(3)).toBe("standard");
    expect(vatKind(5)).toBe("exempt");
    expect(vatKind(0)).toBe("none");
    expect(vatKind(31)).toBe("other");
    expect(vatKind(null)).toBe("unknown");
  });
});
