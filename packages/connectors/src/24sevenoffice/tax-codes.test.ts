import { describe, expect, test } from "bun:test";
import { parseTaxCodeList, taxNumberByTaxId } from "./tax-codes";

describe("parseTaxCodeList", () => {
  test("maps the SOAP list to tax id, posting number, rate and account", () => {
    const codes = parseTaxCodeList({
      GetTaxCodeListResult: {
        TaxCodeElement: [
          {
            AccountNo: 2700,
            TaxId: 3,
            TaxName: "Utgående avgift, høy sats",
            TaxNo: 3,
            TaxRate: 25,
          },
          {
            AccountNo: 0,
            TaxId: 8,
            TaxName: "Avgiftsfritt salg innenfor avg.området",
            TaxNo: 5,
            TaxRate: 0,
          },
        ],
      },
    });
    expect(codes).toEqual([
      {
        accountNumber: 2700,
        name: "Utgående avgift, høy sats",
        rate: 25,
        taxId: 3,
        taxNumber: 3,
      },
      {
        accountNumber: null,
        name: "Avgiftsfritt salg innenfor avg.området",
        rate: 0,
        taxId: 8,
        taxNumber: 5,
      },
    ]);
  });

  test("accepts a single element and string numbers", () => {
    const codes = parseTaxCodeList({
      GetTaxCodeListResult: {
        TaxCodeElement: {
          AccountNo: "0",
          TaxId: "0",
          TaxName: "Ingen avgift",
          TaxNo: "0",
          TaxRate: "0",
        },
      },
    });
    expect(codes).toEqual([
      {
        accountNumber: null,
        name: "Ingen avgift",
        rate: 0,
        taxId: 0,
        taxNumber: 0,
      },
    ]);
  });

  test("skips entries without an id or number, and tolerates an empty result", () => {
    expect(
      parseTaxCodeList({
        GetTaxCodeListResult: { TaxCodeElement: [{ TaxName: "Broken" }] },
      })
    ).toEqual([]);
    expect(parseTaxCodeList(null)).toEqual([]);
  });
});

describe("taxNumberByTaxId", () => {
  test("looks up the posting number for an account's tax id", () => {
    const map = taxNumberByTaxId([
      { accountNumber: 2700, name: "Høy", rate: 25, taxId: 3, taxNumber: 3 },
      { accountNumber: null, name: "Fritt", rate: 0, taxId: 8, taxNumber: 5 },
    ]);
    expect(map.get(8)).toBe(5);
    expect(map.get(3)).toBe(3);
  });
});
