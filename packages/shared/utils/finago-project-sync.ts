/**
 * Nightly sync of Finago projects: the project list (dimension 1), two years
 * of booking lines on cost accounts, and from those each project's stats, each
 * department's use of it, and each department's project share.
 */

import { ID, Query } from "@repo/api";
import type { CostLine } from "@repo/connectors/24sevenoffice";
import { aggregateUsage, parseProjectName, usageKey } from "./finago-projects";

type Data = Record<string, unknown>;
interface SyncRow {
  $id: string;
  [key: string]: unknown;
}

/** Minimal slice of `TablesDB`, structurally satisfied by the real client. */
export interface SyncDb {
  createRow(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Data
  ): Promise<unknown>;
  listRows(
    databaseId: string,
    tableId: string,
    queries?: string[]
  ): Promise<{ rows: SyncRow[] }>;
  updateRow(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Data
  ): Promise<unknown>;
}

export interface SyncDeps {
  budgetMs?: number;
  getProjects: () => Promise<{ name: string; projectId: string }[]>;
  listCostLines: (input: {
    accountNumbers: number[];
    from: string;
    signal?: AbortSignal;
    to: string;
  }) => Promise<CostLine[]>;
  now: Date;
}

export interface SyncResult {
  departments: number;
  inactive: number;
  partial: boolean;
  projects: number;
  usageRows: number;
}

const DB = "app";
const PAGE = 100;
const CHUNK = 100;
const PARALLEL = 10;
const DEFAULT_BUDGET_MS = 240_000;
const FIRST_ACCOUNT = 6000;
const LAST_ACCOUNT = 7999;
const WINDOW_MONTHS = 24;
const DAY_MS = 86_400_000;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function inBatches<T>(
  items: T[],
  work: (item: T) => Promise<unknown>
): Promise<void> {
  for (const batch of chunks(items, PARALLEL)) {
    await Promise.all(batch.map(work));
  }
}

async function listAll(
  db: SyncDb,
  table: string,
  queries: string[]
): Promise<SyncRow[]> {
  const all: SyncRow[] = [];
  for (;;) {
    const { rows } = await db.listRows(DB, table, [
      ...queries,
      Query.limit(PAGE),
      Query.offset(all.length),
    ]);
    all.push(...rows);
    if (rows.length < PAGE) {
      return all;
    }
  }
}

async function findByValues(
  db: SyncDb,
  table: string,
  attribute: string,
  values: string[]
): Promise<SyncRow[]> {
  const found: SyncRow[] = [];
  for (const chunk of chunks(values, CHUNK)) {
    found.push(...(await listAll(db, table, [Query.equal(attribute, chunk)])));
  }
  return found;
}

async function accountNumbers(db: SyncDb): Promise<number[]> {
  const [ledger, types] = await Promise.all([
    listAll(db, "ledger_accounts", [
      Query.equal("active", true),
      Query.between("account_number", FIRST_ACCOUNT, LAST_ACCOUNT),
    ]),
    listAll(db, "expense_cost_types", [Query.equal("active", true)]),
  ]);
  const numbers = new Set<number>();
  for (const row of [...ledger, ...types]) {
    if (typeof row.account_number === "number") {
      numbers.add(row.account_number);
    }
  }
  return [...numbers].sort((a, b) => a - b);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function windowOf(now: Date): { from: string; to: string } {
  const from = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - WINDOW_MONTHS,
      now.getUTCDate()
    )
  );
  return { from: isoDay(from), to: isoDay(new Date(now.getTime() + DAY_MS)) };
}

async function fetchLines(
  accounts: number[],
  deps: SyncDeps,
  budgetMs: number
): Promise<{ lines: CostLine[]; partial: boolean }> {
  const started = Date.now();
  const { from, to } = windowOf(deps.now);
  const lines: CostLine[] = [];
  for (const account of accounts) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining <= 0) {
      return { lines, partial: true };
    }
    const signal = AbortSignal.timeout(remaining);
    try {
      lines.push(
        ...(await deps.listCostLines({
          accountNumbers: [account],
          from,
          signal,
          to,
        }))
      );
    } catch (error) {
      if (signal.aborted) {
        return { lines, partial: true };
      }
      throw error;
    }
  }
  return { lines, partial: false };
}

async function upsert(
  db: SyncDb,
  table: string,
  existing: SyncRow | undefined,
  data: Data
): Promise<void> {
  if (existing) {
    await db.updateRow(DB, table, existing.$id, data);
    return;
  }
  await db.createRow(DB, table, ID.unique(), data);
}

export async function syncFinagoProjects(
  db: SyncDb,
  deps: SyncDeps
): Promise<SyncResult> {
  // A failed project list throws before anything is written.
  const list = await deps.getProjects();
  const accounts = await accountNumbers(db);
  const { lines, partial } = await fetchLines(
    accounts,
    deps,
    deps.budgetMs ?? DEFAULT_BUDGET_MS
  );
  const summary = aggregateUsage(lines);
  const syncedAt = deps.now.toISOString();

  const existingProjects = new Map(
    (
      await findByValues(
        db,
        "finago_projects",
        "project_id",
        list.map((p) => p.projectId)
      )
    ).map((row) => [String(row.project_id), row])
  );
  await inBatches(list, (project) => {
    const stats = summary.projects.get(project.projectId);
    const { series, year } = parseProjectName(project.name);
    const data: Data = {
      active: true,
      name: project.name,
      project_id: project.projectId,
      series,
      synced_at: syncedAt,
      year,
    };
    if (stats) {
      Object.assign(data, {
        first_line_date: stats.firstLineDate,
        last_line_date: stats.lastLineDate,
        line_count: stats.lineCount,
        peak_date: stats.peakDate,
      });
    } else if (!(partial && existingProjects.has(project.projectId))) {
      Object.assign(data, {
        first_line_date: null,
        last_line_date: null,
        line_count: 0,
        peak_date: null,
      });
    }
    return upsert(
      db,
      "finago_projects",
      existingProjects.get(project.projectId),
      data
    );
  });

  const usageProjectIds = [
    ...new Set([...summary.usage.values()].map((u) => u.projectId)),
  ];
  const existingUsage = new Map(
    (
      await findByValues(
        db,
        "finago_project_usage",
        "project_id",
        usageProjectIds
      )
    ).map((row) => [
      usageKey(String(row.project_id), String(row.department_id)),
      row,
    ])
  );
  await inBatches([...summary.usage.entries()], ([key, u]) =>
    upsert(db, "finago_project_usage", existingUsage.get(key), {
      department_id: u.departmentId,
      first_line_date: u.firstLineDate,
      last_line_date: u.lastLineDate,
      line_count: u.lineCount,
      project_id: u.projectId,
      synced_at: syncedAt,
    })
  );

  let inactive = 0;
  let departments = 0;
  if (!partial) {
    const listed = new Set(list.map((p) => p.projectId));
    const active = await listAll(db, "finago_projects", [
      Query.equal("active", true),
    ]);
    const gone = active.filter((row) => !listed.has(String(row.project_id)));
    await inBatches(gone, (row) =>
      db.updateRow(DB, "finago_projects", row.$id, { active: false })
    );
    inactive = gone.length;

    const known = await findByValues(db, "departments", "$id", [
      ...summary.departmentShare.keys(),
    ]);
    await inBatches(known, (row) => {
      const share = summary.departmentShare.get(row.$id);
      return share && share.total > 0
        ? db.updateRow(DB, "departments", row.$id, {
            project_share: share.withProject / share.total,
          })
        : Promise.resolve();
    });
    departments = known.length;
  }

  return {
    departments,
    inactive,
    partial,
    projects: list.length,
    usageRows: summary.usage.size,
  };
}
