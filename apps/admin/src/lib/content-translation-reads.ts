import { Query } from "@repo/api";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import {
  type TranslationContentType,
  translationReadPermissions,
} from "@repo/shared/utils/content-read-permissions";

const PAGE_SIZE = 100;
const READ_ENTRY = /^read\(/;

interface TranslationDb {
  listRows: <T>(
    databaseId: string,
    tableId: string,
    queries?: string[]
  ) => Promise<{ rows: T[] }>;
  updateRow: (
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Record<string, unknown>,
    permissions?: string[]
  ) => Promise<unknown>;
}

/**
 * Sets the read entries of every translation row of a content item to what its
 * (new) parent status calls for, keeping any non-read entries. Publish paths
 * that change only the parent's status call this afterwards.
 */
export async function restampTranslationReads(
  db: TranslationDb,
  contentType: TranslationContentType,
  contentId: string,
  parentStatus: string | null
): Promise<void> {
  const reads = translationReadPermissions(contentType, parentStatus);
  let cursor: string | null = null;
  while (true) {
    const queries: string[] = [
      Query.equal("content_type", contentType),
      Query.equal("content_id", contentId),
      Query.orderAsc("$id"),
      Query.limit(PAGE_SIZE),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const page: { rows: ContentTranslations[] } =
      await db.listRows<ContentTranslations>(
        "app",
        "content_translations",
        queries
      );
    for (const row of page.rows) {
      const kept = (row.$permissions ?? []).filter(
        (entry) => !READ_ENTRY.test(entry)
      );
      await db.updateRow("app", "content_translations", row.$id, {}, [
        ...kept,
        ...reads,
      ]);
    }
    cursor = page.rows.at(-1)?.$id ?? null;
    if (page.rows.length < PAGE_SIZE || !cursor) {
      return;
    }
  }
}
