export interface LedgerAccountRow {
  $id: string;
  account_number: number;
  active: boolean;
  name: string | null;
  synced_at: string;
  /** Finago tax id from the account (not usable as a posting tax number). */
  tax_code: number | null;
  /** Finago posting tax number, resolved from `tax_code`. */
  vat_code: number | null;
}

export function toLedgerAccountRow(
  account: {
    name?: string | null;
    number?: number | null;
    taxId?: number | null;
  },
  vatCodes: Map<number, number>,
  syncedAt: string
): LedgerAccountRow | null {
  if (typeof account.number !== "number") {
    return null;
  }
  const taxId = typeof account.taxId === "number" ? account.taxId : null;
  return {
    $id: String(account.number),
    account_number: account.number,
    active: true,
    name: account.name ?? null,
    synced_at: syncedAt,
    tax_code: taxId,
    vat_code: taxId === null ? null : (vatCodes.get(taxId) ?? null),
  };
}
