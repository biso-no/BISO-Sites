/**
 * 24SevenOffice tax codes (SOAP `GetTaxCodeList`).
 *
 * Accounts carry a tax *id*; ledger postings need the tax *number*
 * (e.g. id 8 → number 5, "Avgiftsfritt salg"). The REST `/taxes` endpoint is
 * not granted to our client, so the list comes from the SOAP account service.
 */
import { getValidSession } from "./auth";
import { createAuthenticatedClient } from "./client";

export interface TaxCodeListEntry {
  /** VAT ledger account, or null when the code books no VAT. */
  accountNumber: number | null;
  name: string;
  rate: number;
  taxId: number;
  /** The number to send as `tax.number` on a transaction line. */
  taxNumber: number;
}

interface RawTaxCode {
  AccountNo?: number | string | null;
  TaxId?: number | string | null;
  TaxName?: string | null;
  TaxNo?: number | string | null;
  TaxRate?: number | string | null;
}

export interface GetTaxCodeListResult {
  GetTaxCodeListResult?: {
    TaxCodeElement?: RawTaxCode | RawTaxCode[] | null;
  } | null;
}

function toNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseTaxCodeList(
  result: GetTaxCodeListResult | null | undefined
): TaxCodeListEntry[] {
  const raw = result?.GetTaxCodeListResult?.TaxCodeElement;
  let list: RawTaxCode[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw) {
    list = [raw];
  }

  const entries: TaxCodeListEntry[] = [];
  for (const code of list) {
    const taxId = toNumber(code.TaxId);
    const taxNumber = toNumber(code.TaxNo);
    if (taxId === null || taxNumber === null) {
      continue;
    }
    const account = toNumber(code.AccountNo);
    entries.push({
      accountNumber: account && account > 0 ? account : null,
      name: code.TaxName ?? "",
      rate: toNumber(code.TaxRate) ?? 0,
      taxId,
      taxNumber,
    });
  }
  return entries;
}

export function taxNumberByTaxId(
  codes: TaxCodeListEntry[]
): Map<number, number> {
  return new Map(codes.map((code) => [code.taxId, code.taxNumber]));
}

export async function getTaxCodes(): Promise<TaxCodeListEntry[]> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("account", session);
  const [result] = (await client.GetTaxCodeListAsync({})) as [
    GetTaxCodeListResult,
  ];
  return parseTaxCodeList(result);
}
