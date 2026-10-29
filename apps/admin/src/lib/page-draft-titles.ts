import { Query } from "@repo/api";
import { PAGE_DRAFTS_TABLE_ID } from "@repo/api/page-builder";

/** Room for every page of one list or search, two locales each. */
const DRAFT_LOOKUP_LIMIT = 500;

interface TranslationRef {
  $id: string;
  title?: string | null;
}

interface PageWithTranslations {
  $id: string;
  translation_refs?: TranslationRef[] | null;
}

interface DraftTitleDb {
  listRows(
    databaseId: string,
    tableId: string,
    queries?: string[]
  ): Promise<{ rows: { $id: string; title?: string | null }[] }>;
}

/**
 * The pages with each translation's title replaced by its draft's title when
 * the draft has one. A translation row holds the published title; edits to a
 * title live on the draft row until they are published. `db` must be the
 * admin client's: the draft table is service-only.
 */
export async function withDraftTitles<Page extends PageWithTranslations>(
  db: DraftTitleDb,
  pages: Page[]
): Promise<Page[]> {
  if (pages.length === 0) {
    return pages;
  }
  const drafts = await db.listRows("app", PAGE_DRAFTS_TABLE_ID, [
    Query.equal(
      "page_id",
      pages.map((page) => page.$id)
    ),
    Query.select(["$id", "title"]),
    Query.limit(DRAFT_LOOKUP_LIMIT),
  ]);
  const titles = new Map<string, string>();
  for (const draft of drafts.rows) {
    if (draft.title) {
      titles.set(draft.$id, draft.title);
    }
  }
  return pages.map((page) => ({
    ...page,
    translation_refs: page.translation_refs?.map((translation) => ({
      ...translation,
      title: titles.get(translation.$id) ?? translation.title,
    })),
  }));
}
