import { Query } from "@repo/api";

const DATABASE_ID = "app";
const PAGE_SIZE = 100;

/** The `listRows` slice of `TablesDB` a scan needs. */
export interface TableScanDb<Row extends { $id: string }> {
  listRows(params: {
    databaseId: string;
    tableId: string;
    queries?: string[];
  }): Promise<{ rows: Row[] }>;
}

/**
 * Yields every row of an `app` table, 100 at a time by `$id` cursor.
 * `leadingQueries` go before the page size on every request.
 */
export async function* scanTable<Row extends { $id: string }>(
  db: TableScanDb<Row>,
  tableId: string,
  leadingQueries: string[] = []
): AsyncGenerator<Row> {
  let cursor: string | undefined;
  while (true) {
    const queries = [...leadingQueries, Query.limit(PAGE_SIZE)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const { rows } = await db.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries,
    });
    for (const row of rows) {
      yield row;
    }
    if (rows.length < PAGE_SIZE) {
      return;
    }
    cursor = rows.at(-1)?.$id;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
