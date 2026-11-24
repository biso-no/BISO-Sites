import { mock } from "bun:test";

/**
 * In-memory stand-in for the Appwrite tables client in action tests. Rows
 * live per table; `listRows` honours `equal`, `notEqual`, `isNull`,
 * `isNotNull`, `contains`, `or`, `cursorAfter` and `limit` (other queries,
 * such as `select`, are ignored), so code under test reads back what it wrote.
 */
export type FakeRow = Record<string, unknown> & { $id: string };

interface ParsedQuery {
  attribute?: string;
  method: string;
  values?: unknown[];
}

function parse(query: string): ParsedQuery {
  return JSON.parse(query) as ParsedQuery;
}

function contains(value: unknown, needle: unknown): boolean {
  if (typeof value === "string" && typeof needle === "string") {
    return value.toLowerCase().includes(needle.toLowerCase());
  }
  return Array.isArray(value) && value.includes(needle);
}

function matches(row: FakeRow, query: ParsedQuery): boolean {
  const value = row[query.attribute ?? ""] ?? null;
  const values = query.values ?? [];
  switch (query.method) {
    case "equal":
      return values.includes(value);
    case "notEqual":
      return !values.includes(value);
    case "isNull":
      return value === null;
    case "isNotNull":
      return value !== null;
    case "contains":
      return values.some((needle) => contains(value, needle));
    case "or":
      return values.some((inner) =>
        matches(
          row,
          (typeof inner === "string" ? parse(inner) : inner) as ParsedQuery
        )
      );
    default:
      return true;
  }
}

/** Runs `work` as an SDK call would: a throw becomes a rejection. */
function settle<T>(work: () => T): Promise<T> {
  try {
    return Promise.resolve(work());
  } catch (error) {
    return Promise.reject(error);
  }
}

function notFound(): Error {
  return Object.assign(new Error("Row not found"), { code: 404 });
}

export function createFakeTablesDb() {
  const tables = new Map<string, FakeRow[]>();
  let nextId = 0;

  const table = (tableId: string): FakeRow[] => {
    const existing = tables.get(tableId);
    if (existing) {
      return existing;
    }
    const created: FakeRow[] = [];
    tables.set(tableId, created);
    return created;
  };

  const db = {
    createRow: mock(
      (
        _databaseId: string,
        tableId: string,
        rowId: string,
        data: Record<string, unknown>
      ) =>
        settle(() => {
          nextId += 1;
          const $id = rowId === "unique()" ? `new-${tableId}-${nextId}` : rowId;
          const row: FakeRow = { ...data, $id };
          table(tableId).push(row);
          return { ...row };
        })
    ),
    deleteRow: mock((_databaseId: string, tableId: string, rowId: string) =>
      settle(() => {
        const rows = table(tableId);
        const index = rows.findIndex((row) => row.$id === rowId);
        if (index === -1) {
          throw notFound();
        }
        rows.splice(index, 1);
        return {};
      })
    ),
    listRows: mock(
      (_databaseId: string, tableId: string, queries: string[] = []) =>
        settle(() => {
          const parsed = queries.map(parse);
          const filtered = table(tableId).filter((row) =>
            parsed.every((query) => matches(row, query))
          );
          const cursor = parsed.find((query) => query.method === "cursorAfter");
          const start = cursor
            ? filtered.findIndex((row) => row.$id === cursor.values?.[0]) + 1
            : 0;
          const limit = parsed.find((query) => query.method === "limit");
          const end = limit ? start + Number(limit.values?.[0]) : undefined;
          return {
            rows: filtered.slice(start, end).map((row) => ({ ...row })),
            total: filtered.length,
          };
        })
    ),
    updateRow: mock(
      (
        _databaseId: string,
        tableId: string,
        rowId: string,
        data: Record<string, unknown> = {}
      ) =>
        settle(() => {
          const row = table(tableId).find(
            (candidate) => candidate.$id === rowId
          );
          if (!row) {
            throw notFound();
          }
          Object.assign(row, data);
          return { ...row };
        })
    ),
  };

  return {
    db,
    /** Replaces every table's rows. */
    reset(seed: Record<string, FakeRow[]>): void {
      tables.clear();
      nextId = 0;
      for (const fn of Object.values(db)) {
        fn.mockClear();
      }
      for (const [tableId, rows] of Object.entries(seed)) {
        tables.set(
          tableId,
          rows.map((row) => ({ ...row }))
        );
      }
    },
    rows(tableId: string): FakeRow[] {
      return table(tableId);
    },
  };
}
