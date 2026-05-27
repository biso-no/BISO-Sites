import type { Models, TablesDB } from "node-appwrite";

/**
 * Typed write helpers for Appwrite tables.
 *
 * `TablesDB.createRow<R>` / `updateRow<R>` derive the `data` parameter type from
 * the same generic as the return type — and that generic is the READ-shaped row
 * (relationship columns typed as the full related object, reverse relations
 * required). On write, Appwrite accepts a relationship as either the related
 * object or its ID string and never wants reverse relations, so the read shape
 * is wrong for input. These helpers decouple input from output: pass a
 * write-input shape (see `./types/inputs`) for `data` and get the read-shaped
 * row back. The single unavoidable bridge cast lives here, not at every call
 * site.
 */
type RowWriteData = Partial<Models.Row> & Record<string, unknown>;

export function createTypedRow<R extends Models.Row, D extends object>(
  db: TablesDB,
  databaseId: string,
  tableId: string,
  rowId: string,
  data: D,
  permissions?: string[]
): Promise<R> {
  return db.createRow<Models.DefaultRow>(
    databaseId,
    tableId,
    rowId,
    data as RowWriteData,
    permissions
  ) as unknown as Promise<R>;
}

export function updateTypedRow<R extends Models.Row, D extends object>(
  db: TablesDB,
  databaseId: string,
  tableId: string,
  rowId: string,
  data: D,
  permissions?: string[]
): Promise<R> {
  return db.updateRow<Models.DefaultRow>(
    databaseId,
    tableId,
    rowId,
    data as RowWriteData,
    permissions
  ) as unknown as Promise<R>;
}
