import { describe, expect, test } from "bun:test";
import { toLedgerAccountRow } from "./ledger-account-row";

const VAT_CODES = new Map([
  [3, 3],
  [8, 5],
]);

describe("toLedgerAccountRow", () => {
  test("stores the Finago tax id and the posting VAT number", () => {
    expect(
      toLedgerAccountRow(
        {
          name: "Salgsinntekt - egenandeler, avgiftsfritt",
          number: 3100,
          taxId: 8,
        },
        VAT_CODES,
        "2026-09-11T10:00:00.000Z"
      )
    ).toEqual({
      $id: "3100",
      account_number: 3100,
      active: true,
      name: "Salgsinntekt - egenandeler, avgiftsfritt",
      synced_at: "2026-09-11T10:00:00.000Z",
      tax_code: 8,
      vat_code: 5,
    });
  });

  test("leaves the VAT number empty when the tax id is unknown", () => {
    expect(
      toLedgerAccountRow({ name: "X", number: 3999, taxId: 42 }, VAT_CODES, "t")
        ?.vat_code
    ).toBeNull();
  });

  test("skips an account without a number", () => {
    expect(toLedgerAccountRow({ name: "X" }, VAT_CODES, "t")).toBeNull();
  });
});
