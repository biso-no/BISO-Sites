import { Query } from "@repo/api";
import { orNullIfRowNotFound } from "@repo/api/errors";
import type { createAdminClient } from "@repo/api/server";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import type { TranslationText } from "@repo/shared/search/entries/common";
import type { SearchLocale } from "@repo/shared/search/types";

export type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

export const DB = "app";
const TRANSLATION_TABLE = "content_translations";
const TRANSLATION_LIMIT = 10;
const ID_PAGE_SIZE = 100;

/**
 * A select list naming exactly the columns of `Row`: a column the mapper
 * reads but the select leaves out fails to compile instead of arriving
 * undefined.
 */
export function columns<Row>(keys: { [K in keyof Row & string]: true }) {
  return Object.keys(keys);
}

export function searchLocale(
  value: string | null | undefined
): SearchLocale | null {
  return value === "no" || value === "en" ? value : null;
}

/** One row with only `select`ed columns, or null when the row is missing. */
export async function getRowOrNull<Row>(
  db: AdminDb,
  tableId: string,
  rowId: string,
  select: string[]
): Promise<Row | null> {
  const row = await orNullIfRowNotFound(
    db.getRow({
      databaseId: DB,
      queries: [Query.select(select)],
      rowId,
      tableId,
    })
  );
  return row as unknown as Row | null;
}

/** The `content_translations` rows of one item, in the search locales. */
export async function contentTranslations(
  db: AdminDb,
  contentType: string,
  contentId: string
): Promise<TranslationText[]> {
  const list = await db.listRows<ContentTranslations>({
    databaseId: DB,
    queries: [
      Query.equal("content_type", contentType),
      Query.equal("content_id", contentId),
      Query.limit(TRANSLATION_LIMIT),
    ],
    tableId: TRANSLATION_TABLE,
  });
  return list.rows.flatMap((row) => {
    const locale = searchLocale(row.locale);
    return locale
      ? [
          {
            additional_fields: row.additional_fields,
            description: row.description,
            locale,
            short_description: row.short_description,
            title: row.title,
          },
        ]
      : [];
  });
}

/** Every matching row id, a page (100) at a time, by cursor. */
export async function* pagedIds(
  db: AdminDb,
  tableId: string,
  filters: string[]
): AsyncGenerator<string[]> {
  let cursor: string | undefined;
  for (;;) {
    const queries = [
      ...filters,
      Query.select(["$id"]),
      Query.limit(ID_PAGE_SIZE),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const { rows } = await db.listRows({ databaseId: DB, queries, tableId });
    const ids = rows.map((row) => row.$id);
    if (ids.length > 0) {
      yield ids;
    }
    if (ids.length < ID_PAGE_SIZE) {
      return;
    }
    cursor = ids.at(-1);
  }
}
