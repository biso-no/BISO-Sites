/**
 * Roster sync orchestration with injected I/O, so the guards (overlap, empty
 * tree, write order) are testable without Appwrite or 24SO. `main.ts` wires
 * the real dependencies.
 */

import type {
  Company,
  CustomerCategoryMapping,
  MembershipInvoiceLine,
} from "@repo/connectors/24sevenoffice";
import { SKIPPED_STATUS_CODE } from "@repo/shared/utils/member-roster-sync";
import {
  buildRosterRows,
  foldMembers,
  type PlanRow,
  type RosterRow,
  resolveMembers,
  selectActivePlans,
} from "./roster";

export interface SyncDeps {
  countRunningExecutions: () => Promise<number>;
  deleteStaleRows: (runId: string) => Promise<number>;
  /** Every company in 24SO (resolves ExternalId-listed tree members). */
  fetchCompanies: () => Promise<Company[]>;
  fetchInvoiceLines: (
    companyIds: number[],
    productIds: ReadonlySet<number>
  ) => Promise<MembershipInvoiceLine[]>;
  fetchTree: () => Promise<CustomerCategoryMapping[]>;
  listCampusIds: () => Promise<ReadonlySet<string>>;
  listPlanRows: () => Promise<PlanRow[]>;
  log: (message: string) => void;
  newRunId: () => string;
  now: () => Date;
  /** Mirrors every 24SO membership product into `memberships`; throws on failure. */
  syncCatalog: () => Promise<{
    created: number;
    skipped: number;
    updated: number;
  }>;
  upsertRows: (rows: RosterRow[]) => Promise<void>;
}

export type SyncResult =
  | { ok: true; skipped: "already-running" }
  | {
      durationMs: number;
      members: number;
      ok: true;
      removed: number;
      unknownCampus: number;
    };

const OK_STATUS_CODE = 200;

export function httpStatusFor(result: SyncResult): number {
  return "skipped" in result ? SKIPPED_STATUS_CODE : OK_STATUS_CODE;
}

export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const startedAt = Date.now();

  // This execution is itself "processing", so more than one means overlap.
  if ((await deps.countRunningExecutions()) > 1) {
    deps.log("Another roster sync is already running; skipping.");
    return { ok: true, skipped: "already-running" };
  }

  const runId = deps.newRunId();
  // Refresh the catalog first so plan rows (and the live check) cover every
  // 24SO membership product; a failure stops the run before any roster write.
  const catalog = await deps.syncCatalog();
  deps.log(
    `Catalog: ${catalog.created} created, ${catalog.updated} updated, ${catalog.skipped} skipped`
  );

  const plans = selectActivePlans(await deps.listPlanRows(), deps.now());
  deps.log(`Active plans: ${plans.size}`);

  const tree = await deps.fetchTree();
  const members = foldMembers(tree, plans);
  deps.log(`Tree pairs: ${tree.length}; current members: ${members.size}`);

  // Never let an empty or failed 24SO response wipe the roster.
  if (members.size === 0) {
    throw new Error(
      "24SO returned zero current members; keeping previous roster"
    );
  }

  const companies = await deps.fetchCompanies();
  const resolved = resolveMembers(members, companies);
  deps.log(
    `Companies: ${companies.length}; members after id resolution: ${resolved.size}`
  );

  const companyIds = [...resolved.keys()];
  const productIds = new Set([...plans.values()].map((p) => p.productId));
  const [invoiceLines, validCampusIds] = await Promise.all([
    deps.fetchInvoiceLines(companyIds, productIds),
    deps.listCampusIds(),
  ]);
  deps.log(`Invoice lines: ${invoiceLines.length}`);

  const rows = buildRosterRows({
    companies,
    invoiceLines,
    members: resolved,
    runId,
    validCampusIds,
  });
  await deps.upsertRows(rows);
  const removed = await deps.deleteStaleRows(runId);

  const unknownCampus = rows.filter((r) => r.campus_id === null).length;
  deps.log(
    `Upserted ${rows.length}; removed ${removed}; unknown campus ${unknownCampus}`
  );

  return {
    durationMs: Date.now() - startedAt,
    members: rows.length,
    ok: true,
    removed,
    unknownCampus,
  };
}
