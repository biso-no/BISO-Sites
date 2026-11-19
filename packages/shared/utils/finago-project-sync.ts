/**
 * Daily sync of Finago projects: the project list (dimension 1), two years
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

/**
 * Something looked wrong, so part of the run was held back:
 * `empty_project_list` / `project_list_shrank` — Finago's list was empty or
 * under half the active projects, so nothing was marked inactive;
 * `no_cost_lines` — a full run read no lines, so no stats were cleared.
 */
export type SyncWarning =
  | "empty_project_list"
  | "no_cost_lines"
  | "project_list_shrank";

export interface SyncResult {
  /** How many accounts there are to read. */
  accountCount: number;
  /**
   * Accounts read in an unbroken row from the start offset; the next run
   * resumes right after them.
   */
  completed: number;
  departments: number;
  inactive: number;
  partial: boolean;
  /** Projects on Finago's active list. */
  projects: number;
  usageRows: number;
  warnings: SyncWarning[];
  /** Project rows written: the listed ones plus deactivated editions with lines. */
  written: number;
}

const DB = "app";
const PAGE = 100;
const CHUNK = 100;
const PARALLEL = 10;
/** Accounts whose lines are read at the same time. */
const CONCURRENT_ACCOUNTS = 4;
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

/**
 * Reads each account's lines, four at a time, from `startOffset` (rotated).
 * When the budget is spent no new account starts and the ones in flight are
 * aborted. `completed` counts the accounts read in an unbroken row from the
 * start, so the next run resumes after them and never skips one; lines from
 * every account that finished are kept. The first failed read aborts the
 * others and fails the run.
 */
async function fetchLines(
  accounts: number[],
  deps: SyncDeps,
  budgetMs: number
): Promise<{ completed: number; lines: CostLine[]; partial: boolean }> {
  const started = Date.now();
  const { from, to } = windowOf(deps.now);
  const offset =
    accounts.length > 0 ? (deps.startOffset ?? 0) % accounts.length : 0;
  const rotated = [...accounts.slice(offset), ...accounts.slice(0, offset)];
  const read: (CostLine[] | undefined)[] = rotated.map(() => undefined);
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), Math.max(budgetMs, 0));
  let next = 0;
  let failure: { error: unknown } | null = null;

  const worker = async (): Promise<void> => {
    while (next < rotated.length && !stop.signal.aborted) {
      if (Date.now() - started >= budgetMs) {
        stop.abort();
        return;
      }
      const index = next;
      next += 1;
      try {
        read[index] = await deps.listCostLines({
          accountNumbers: [rotated[index] as number],
          from,
          signal: stop.signal,
          to,
        });
      } catch (error) {
        // Aborted reads are the budget (or another read's failure) at work.
        if (!stop.signal.aborted) {
          failure = { error };
          stop.abort();
        }
        return;
      }
    }
  };

  try {
    await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENT_ACCOUNTS, rotated.length) },
        worker
      )
    );
  } finally {
    clearTimeout(timer);
  }
  if (failure) {
    throw (failure as { error: unknown }).error;
  }

  let completed = 0;
  while (completed < rotated.length && read[completed] !== undefined) {
    completed += 1;
  }
  const lines = read.flatMap((accountLines) => accountLines ?? []);
  const partial = completed < rotated.length;
  if (partial) {
    console.warn(
      `[Finago Project Sync] Ran out of time after ${completed} of ${accounts.length} accounts`
    );
  } else {
    console.log(
      `[Finago Project Sync] Read ${completed} of ${accounts.length} accounts`
    );
  }
  return { completed, lines, partial };
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

type Summary = ReturnType<typeof aggregateUsage>;

interface ProjectTarget {
  active: boolean;
  name: string;
  projectId: string;
}

interface WriteMode {
  /** Keep existing stats when nothing new is known (a partial or empty run). */
  keepStats: boolean;
  partial: boolean;
  syncedAt: string;
}

/** Each project's name: Finago's list first, then the stored row, then a line's. */
function projectNames(
  list: { name: string; projectId: string }[],
  existing: Map<string, SyncRow>,
  lines: CostLine[]
): Map<string, string> {
  const names = new Map<string, string>();
  for (const line of lines) {
    if (line.projectId && line.projectName && !names.has(line.projectId)) {
      names.set(line.projectId, line.projectName);
    }
  }
  for (const [projectId, row] of existing) {
    if (typeof row.name === "string" && row.name) {
      names.set(projectId, row.name);
    }
  }
  for (const project of list) {
    names.set(project.projectId, project.name);
  }
  return names;
}

/**
 * Why Finago's list can't be trusted to mark projects inactive: it is empty,
 * or under half of the projects that are active now (a glitch, or the wrong
 * company).
 */
function listWarning(listed: number, activeNow: number): SyncWarning | null {
  if (listed === 0) {
    return "empty_project_list";
  }
  return listed * 2 < activeNow ? "project_list_shrank" : null;
}

function writeProjects(
  db: SyncDb,
  targets: ProjectTarget[],
  existingProjects: Map<string, SyncRow>,
  summary: Summary,
  mode: WriteMode
): Promise<void> {
  return inBatches(targets, (project) => {
    const existing = existingProjects.get(project.projectId);
    const stats = summary.projects.get(project.projectId);
    const { series, year } = parseProjectName(project.name);
    const data: Data = {
      name: project.name,
      project_id: project.projectId,
      series,
      year,
    };
    // `synced_at` marks a full run, so a partial run leaves it untouched.
    if (!mode.partial) {
      data.synced_at = mode.syncedAt;
    }
    if (project.active) {
      data.active = true;
    } else if (!existing) {
      data.active = false;
    }
    if (stats && existing && mode.partial) {
      Object.assign(data, widenStats(existing, stats));
    } else if (stats) {
      Object.assign(data, {
        first_line_date: stats.firstLineDate,
        last_line_date: stats.lastLineDate,
        line_count: stats.lineCount,
        peak_date: stats.peakDate,
      });
    } else if (!(existing && mode.keepStats)) {
      Object.assign(data, {
        first_line_date: null,
        last_line_date: null,
        line_count: 0,
        peak_date: null,
      });
    }
    return upsert(db, "finago_projects", existing, data);
  });
}

async function writeUsage(
  db: SyncDb,
  summary: Summary,
  mode: WriteMode
): Promise<void> {
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
      existing && mode.partial
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
      ...(mode.partial ? {} : { synced_at: mode.syncedAt }),
    });
  });
}

/** Each known department's share of lines with a project. Returns how many. */
async function writeShares(db: SyncDb, summary: Summary): Promise<number> {
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
  return known.length;
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

  const listedIds = new Set(list.map((p) => p.projectId));
  const lineProjectIds = lines.flatMap((line) =>
    line.projectId ? [line.projectId] : []
  );
  const existingProjects = new Map(
    (
      await findByValues(db, "finago_projects", "project_id", [
        ...new Set([...listedIds, ...lineProjectIds]),
      ])
    ).map((row) => [String(row.project_id), row])
  );
  // Read before anything is written: the projects active until now.
  const activeBefore = partial
    ? []
    : await listAll(db, "finago_projects", [Query.equal("active", true)]);

  const warnings: SyncWarning[] = [];
  const holdBack = partial
    ? null
    : listWarning(list.length, activeBefore.length);
  if (holdBack) {
    warnings.push(holdBack);
    console.warn(
      `[Finago Project Sync] Finago listed ${list.length} projects against ${activeBefore.length} active; none marked inactive`
    );
  }
  const noLines = lines.length === 0;
  if (noLines && !partial) {
    warnings.push("no_cost_lines");
    console.warn(
      "[Finago Project Sync] No cost lines were read; stats are kept as they were"
    );
  }

  const names = projectNames(list, existingProjects, lines);
  const summary = aggregateUsage(lines, (projectId) => {
    const name = names.get(projectId);
    return name ? parseProjectName(name).year : null;
  });

  // The element list is active-only, so editions finance has closed show up
  // only in the lines: keep their history as inactive rows.
  const targets: ProjectTarget[] = list.map((p) => ({ active: true, ...p }));
  for (const projectId of summary.projects.keys()) {
    const name = names.get(projectId);
    if (!listedIds.has(projectId) && name) {
      targets.push({ active: false, name, projectId });
    }
  }

  const mode: WriteMode = {
    keepStats: partial || noLines,
    partial,
    syncedAt: deps.now.toISOString(),
  };
  await writeProjects(db, targets, existingProjects, summary, mode);
  await writeUsage(db, summary, mode);

  let inactive = 0;
  let departments = 0;
  if (!partial) {
    if (!holdBack) {
      const gone = activeBefore.filter(
        (row) => !listedIds.has(String(row.project_id))
      );
      await inBatches(gone, (row) =>
        db.updateRow(DB, "finago_projects", row.$id, { active: false })
      );
      inactive = gone.length;
    }
    departments = await writeShares(db, summary);
  }

  return {
    accountCount: accounts.length,
    completed,
    departments,
    inactive,
    partial,
    projects: list.length,
    usageRows: summary.usage.size,
    warnings,
    written: targets.length,
  };
}
