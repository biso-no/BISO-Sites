/**
 * member-roster-sync Appwrite Function.
 *
 * Rebuilds app.member_roster from 24SevenOffice: the customer-category tree
 * (who holds an active membership category), company names/emails, and each
 * member's membership invoice (campus dimension). Schedule, timeout and
 * deployment are configured in the Appwrite console, not here.
 *
 * The admin page reads run status from this function's executions, so a
 * failure must surface as a 500 response (and in the logs via context.error).
 */

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Memberships } from "@repo/api/types/appwrite";
import {
  getAllCompanies,
  getCustomerCategoryTree,
  getMembershipInvoices,
  syncMembershipCatalog,
} from "@repo/connectors/24sevenoffice";
import { STALE_EXECUTION_MS } from "@repo/shared/utils/member-roster-sync";
import type { RosterRow } from "./roster";
import { httpStatusFor, runSync } from "./run";
import { adoptRuntimeApiKey } from "./runtime-key";

const DB = "app";
const ROSTER_TABLE = "member_roster";
/** The tree call took 70s against production; leave generous headroom. */
const TREE_TIMEOUT_MS = 180_000;
const INVOICE_TIMEOUT_MS = 120_000;
/** Full company listing took ~12s against production (~55k rows). */
const COMPANIES_TIMEOUT_MS = 180_000;
const UPSERT_BATCH = 100;
/** Bulk delete may cap rows per call; bounded so a bad query can't spin forever. */
const MAX_DELETE_ROUNDS = 100;
const LOG_TAG = "[member-roster-sync]";

type LogFn = (...messages: unknown[]) => void;

interface AppwriteContext {
  error: LogFn;
  log: LogFn;
  req: { headers?: Record<string, string | undefined> };
  res: { json: (data: unknown, statusCode?: number) => unknown };
}

export default async function main(context: AppwriteContext) {
  adoptRuntimeApiKey(context.req.headers);
  try {
    const { db, functions } = await createAdminClient();
    const functionId = process.env.APPWRITE_FUNCTION_ID;

    const result = await runSync({
      countRunningExecutions: async () => {
        // Outside the Appwrite runtime (a manual local run) there is no id.
        if (!functionId) {
          return 0;
        }
        const list = await functions.listExecutions({
          functionId,
          queries: [
            Query.equal("status", ["processing"]),
            Query.greaterThan(
              "$createdAt",
              new Date(Date.now() - STALE_EXECUTION_MS).toISOString()
            ),
            Query.limit(1),
          ],
        });
        return list.total;
      },
      deleteStaleRows: async (runId) => {
        let removed = 0;
        for (let round = 0; round < MAX_DELETE_ROUNDS; round++) {
          // Always filtered: deleteRows with no queries empties the table.
          const deleted = await db.deleteRows({
            databaseId: DB,
            queries: [Query.notEqual("sync_run_id", runId)],
            tableId: ROSTER_TABLE,
          });
          if (deleted.total === 0) {
            break;
          }
          removed += deleted.total;
        }
        return removed;
      },
      fetchCompanies: () =>
        getAllCompanies({ timeoutMs: COMPANIES_TIMEOUT_MS }),
      fetchInvoiceLines: (ids, productIds) =>
        getMembershipInvoices(ids, productIds, {
          timeoutMs: INVOICE_TIMEOUT_MS,
        }),
      fetchTree: () => getCustomerCategoryTree({ timeoutMs: TREE_TIMEOUT_MS }),
      listCampusIds: async () => {
        const campuses = await db.listRows<Campus>(DB, "campus", [
          Query.select(["$id"]),
          Query.limit(100),
        ]);
        return new Set(campuses.rows.map((row) => row.$id));
      },
      listPlanRows: async () => {
        const plans = await db.listRows<Memberships>(DB, "memberships", [
          Query.select([
            "membership_id",
            "name",
            "category",
            "startDate",
            "expiryDate",
          ]),
          Query.limit(500),
        ]);
        return plans.rows.map((row) => ({
          category: row.category,
          expiryDate: row.expiryDate,
          membership_id: row.membership_id,
          name: row.name,
          startDate: row.startDate,
        }));
      },
      log: (message) => context.log(`${LOG_TAG} ${message}`),
      newRunId: () => ID.unique(),
      now: () => new Date(),
      syncCatalog: () => syncMembershipCatalog(),
      upsertRows: async (rows: RosterRow[]) => {
        for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
          await db.upsertRows({
            databaseId: DB,
            rows: rows.slice(i, i + UPSERT_BATCH),
            tableId: ROSTER_TABLE,
          });
        }
      },
    });
    return context.res.json(result, httpStatusFor(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.error(`${LOG_TAG} Sync failed: ${message}`);
    if (error instanceof Error && error.stack) {
      context.error(error.stack);
    }
    return context.res.json({ error: message, ok: false }, 500);
  }
}
