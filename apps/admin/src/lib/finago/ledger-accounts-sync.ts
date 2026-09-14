import type { Models } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import {
  getTaxCodes,
  listAccounts,
  taxNumberByTaxId,
} from "@repo/connectors/24sevenoffice";
import {
  type LedgerAccountRow,
  toLedgerAccountRow,
} from "./ledger-account-row";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

export interface LedgerSyncResult {
  failed: number;
  succeeded: number;
  syncedAt: string;
  total: number;
}

/**
 * Upserts `ledger_accounts` from the Finago chart of accounts, with each
 * account's posting VAT number. Used by the Regnskap page and the expense
 * admin's sync route.
 */
export async function syncLedgerAccounts(
  db: AdminDb
): Promise<LedgerSyncResult> {
  const syncedAt = new Date().toISOString();
  const [accounts, taxCodes] = await Promise.all([
    listAccounts(),
    getTaxCodes(),
  ]);
  const vatCodes = taxNumberByTaxId(taxCodes);

  const rows = accounts
    .map((account) => toLedgerAccountRow(account, vatCodes, syncedAt))
    .filter((row): row is LedgerAccountRow => row !== null);

  const results = await Promise.allSettled(
    rows.map((row) =>
      db.upsertRow<Models.DefaultRow>("app", "ledger_accounts", row.$id, row)
    )
  );
  const succeeded = results.filter((r) => r.status === "fulfilled").length;

  return {
    failed: results.length - succeeded,
    succeeded,
    syncedAt,
    total: accounts.length,
  };
}
