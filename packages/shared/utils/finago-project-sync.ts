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
  /** Which account to start from (rotated), so a run that timed out resumes. */
  startOffset?: number;
}

export interface SyncResult {
  /** Accounts whose lines were read, and how many there are. */
  accountCount: number;
  completed: number;
  departments: number;
  inactive: number;
  partial: boolean;
  /** Projects on Finago's active list. */
  projects: number;
  usageRows: number;
  /** Project rows written: the listed ones plus deactivated editions with lines. */
  written: number;
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
): Promise<{ completed: number; lines: CostLine[]; partial: boolean }> {
  const started = Date.now();
  const { from, to } = windowOf(deps.now);
  const lines: CostLine[] = [];
  const offset =
    accounts.length > 0 ? (deps.startOffset ?? 0) % accounts.length : 0;
  const rotated = [...accounts.slice(offset), ...accounts.slice(0, offset)];
  let completed = 0;
  for (const account of rotated) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining <= 0) {
      console.warn(
        `[Finago Project Sync] Ran out of time after ${completed} of ${accounts.length} accounts`
      );
      return { completed, lines, partial: true };
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
      completed += 1;
    } catch (error) {
      if (signal.aborted) {
        console.warn(
          `[Finago Project Sync] Ran out of time after ${completed} of ${accounts.length} accounts`
        );
        return { completed, lines, partial: true };
      }
      throw error;
    }
  }
  console.log(
    `[Finago Project Sync] Read ${completed} of ${accounts.length} accounts`
  );
  return { completed, lines, partial: false };
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function asDay(value: unknown): string | null {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, 10)
    : null;
}

/** The earlier or later of two ISO days; either may be missing. */
function widerDay(
  a: string | null,
  b: string | null,
  pick: "min" | "max"
): string | null {
  if (a === null || b === null) {
    return a ?? b;
  }
  if (pick === "min") {
    return a < b ? a : b;
  }
  return a > b ? a : b;
}

/**
 * Stats for an existing row on a partial run: what was read may be less than
 * before, so counts and date spans never shrink.
 */
function widenStats(
  existing: SyncRow,
  fresh: {
    firstLineDate: string;
    lastLineDate: string;
    lineCount: number;
    peakDate?: string | null;
  }
): Data {
  const oldCount = asNumber(existing.line_count);
  const data: Data = {
    first_line_date: widerDay(
      asDay(existing.first_line_date),
      fresh.firstLineDate,
      "min"
    ),
    last_line_date: widerDay(
      asDay(existing.last_line_date),
      fresh.lastLineDate,
      "max"
    ),
    line_count: Math.max(oldCount, fresh.lineCount),
  };
  if (fresh.peakDate !== undefined) {
    data.peak_date =
      fresh.lineCount >= oldCount
        ? fresh.peakDate
        : (asDay(existing.peak_date) ?? fresh.peakDate);
  }
  return data;
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
  const { completed, lines, partial } = await fetchLines(
    accounts,
    deps,
    deps.budgetMs ?? DEFAULT_BUDGET_MS
  );
  const summary = aggregateUsage(lines);
  const syncedAt = deps.now.toISOString();

  // `synced_at` marks a FULL run (the route reads the newest one to decide
  // whether a sync is due), so a partial run leaves it untouched.
  const stamp = (data: Data) => {
    if (!partial) {
      data.synced_at = syncedAt;
    }
  };
  const lineNames = new Map<string, string>();
  for (const line of lines) {
    if (line.projectId && line.projectName && !lineNames.has(line.projectId)) {
      lineNames.set(line.projectId, line.projectName);
    }
  }
  const listedIds = new Set(list.map((p) => p.projectId));
  const existingProjects = new Map(
    (
      await findByValues(db, "finago_projects", "project_id", [
        ...new Set([...listedIds, ...summary.projects.keys()]),
      ])
    ).map((row) => [String(row.project_id), row])
  );

  // The element list is active-only, so editions finance has closed show up
  // only in the lines: keep their history as inactive rows.
  const targets: { active: boolean; name: string; projectId: string }[] = [
    ...list.map((p) => ({ active: true, ...p })),
  ];
  for (const projectId of summary.projects.keys()) {
    if (listedIds.has(projectId)) {
      continue;
    }
    const name = existingProjects.has(projectId)
      ? String(existingProjects.get(projectId)?.name ?? "")
      : (lineNames.get(projectId) ?? "");
    if (name) {
      targets.push({ active: false, name, projectId });
    }
  }

  await inBatches(targets, (project) => {
    const existing = existingProjects.get(project.projectId);
    const stats = summary.projects.get(project.projectId);
    const { series, year } = parseProjectName(project.name);
    const data: Data = {
      name: project.name,
      project_id: project.projectId,
      series,
      year,
    };
    stamp(data);
    if (project.active) {
      data.active = true;
    } else if (!existing) {
      data.active = false;
    }
    if (stats && existing && partial) {
      Object.assign(data, widenStats(existing, stats));
    } else if (stats) {
      Object.assign(data, {
        first_line_date: stats.firstLineDate,
        last_line_date: stats.lastLineDate,
        line_count: stats.lineCount,
        peak_date: stats.peakDate,
      });
    } else if (!(partial && existing)) {
      Object.assign(data, {
        first_line_date: null,
        last_line_date: null,
        line_count: 0,
        peak_date: null,
      });
    }
    return upsert(db, "finago_projects", existing, data);
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
  await inBatches([...summary.usage.entries()], ([key, u]) => {
    const existing = existingUsage.get(key);
    const stats =
      existing && partial
        ? widenStats(existing, u)
        : {
            first_line_date: u.firstLineDate,
            last_line_date: u.lastLineDate,
            line_count: u.lineCount,
          };
    return upsert(db, "finago_project_usage", existing, {
      ...stats,
      department_id: u.departmentId,
      project_id: u.projectId,
      ...(partial ? {} : { synced_at: syncedAt }),
    });
  });

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
    accountCount: accounts.length,
    completed,
    departments,
    inactive,
    partial,
    projects: list.length,
    usageRows: summary.usage.size,
    written: targets.length,
  };
}
