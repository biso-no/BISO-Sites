import { type Models, Query } from "@repo/api";

/** The slice of the Appwrite tables client these readers need. */
export interface RowReader {
  listRows<T extends Models.Row>(
    databaseId: string,
    tableId: string,
    queries: string[]
  ): Promise<{ rows: T[] }>;
}

const DATABASE_ID = "app";
const PAGE_SIZE = 100;
/** Appwrite accepts at most 100 values in one `Query.equal`. */
const ID_CHUNK = 100;

/** Every row matching `queries`, read 100 at a time with a cursor. */
export async function listAllRows<T extends Models.Row>(
  db: RowReader,
  tableId: string,
  queries: string[]
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: { rows: T[] } = await db.listRows<T>(DATABASE_ID, tableId, [
      ...queries,
      Query.limit(PAGE_SIZE),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ]);
    rows.push(...page.rows);
    const last = page.rows.at(-1);
    if (page.rows.length < PAGE_SIZE || !last) {
      return rows;
    }
    cursor = last.$id;
  }
}

/**
 * Every row whose `field` is one of `values`, 100 values per query. A `$id`
 * chunk can't match more rows than it has ids, so it needs a single page.
 */
export async function listRowsByIds<T extends Models.Row>(
  db: RowReader,
  tableId: string,
  field: string,
  values: string[],
  queries: string[]
): Promise<T[]> {
  const unique = [...new Set(values)];
  const rows: T[] = [];
  for (let start = 0; start < unique.length; start += ID_CHUNK) {
    const chunk = unique.slice(start, start + ID_CHUNK);
    const chunkQueries = [...queries, Query.equal(field, chunk)];
    if (field === "$id") {
      const page = await db.listRows<T>(DATABASE_ID, tableId, [
        ...chunkQueries,
        Query.limit(chunk.length),
      ]);
      rows.push(...page.rows);
    } else {
      rows.push(...(await listAllRows<T>(db, tableId, chunkQueries)));
    }
  }
  return rows;
}
