/**
 * Finago REST API — Chart of accounts + tax codes
 *
 * Read-only catalog lookups used to populate the local `ledger_accounts` table
 * and to validate tax codes when posting expense transactions.
 */

import { finago } from "./client";
import type { components } from "./schema";

export type LedgerAccount = components["schemas"]["Account1"];
export type TaxCode = components["schemas"]["TaxResponse"];

/**
 * Lists accounts from the Finago chart of accounts. Optional `query` filters by
 * keyword within the account name or number.
 */
export async function listAccounts(query?: string): Promise<LedgerAccount[]> {
  const { data, error } = await finago.GET("/accounts", {
    params: {
      query: query ? { query } : undefined,
      header: { Authorization: "" },
    },
  });

  if (error) {
    throw new Error(`[Finago] list accounts failed: ${JSON.stringify(error)}`);
  }

  return data ?? [];
}

/** Lists the tax codes available in the accounting system. */
export async function listTaxes(): Promise<TaxCode[]> {
  const { data, error } = await finago.GET("/taxes", {
    params: { header: { Authorization: "" } },
  });

  if (error) {
    throw new Error(`[Finago] list taxes failed: ${JSON.stringify(error)}`);
  }

  return data ?? [];
}
