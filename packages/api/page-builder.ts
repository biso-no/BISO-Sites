"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "./server";
import { PageStatus } from "./types/appwrite";
import type { Locale, Pages, PageTranslations } from "./types/appwrite";
import { PageVisibility } from "./types/appwrite";

const DATABASE_ID = "app";
const PAGES_TABLE_ID = "pages";
const PAGE_TRANSLATIONS_TABLE_ID = "page_translations";

export type PageDocument = Record<string, unknown>;

const EMPTY_DOCUMENT: PageDocument = {
  root: { props: {} },
  content: [],
};

const PAGE_SELECT_FIELDS = [
  "$id",
  "$createdAt",
  "$updatedAt",
  "slug",
  "title",
  "status",
  "visibility",
  "template",
  "campus_id",
  "translation_refs.$id",
  "translation_refs.$createdAt",
  "translation_refs.$updatedAt",
  "translation_refs.page_id",
  "translation_refs.locale",
  "translation_refs.title",
  "translation_refs.slug",
  "translation_refs.description",
  "translation_refs.puck_document",
  "translation_refs.draft_document",
  "translation_refs.is_published",
  "translation_refs.published_at",
];

function cloneDocument(document: PageDocument): PageDocument {
  return JSON.parse(JSON.stringify(document));
}

function ensureDocument(document: PageDocument | null | undefined): PageDocument {
  if (!document) {
    return cloneDocument(EMPTY_DOCUMENT);
  }

  return cloneDocument(document);
}

function decodeDocument(value: unknown): PageDocument | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as PageDocument;
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value as PageDocument;
  }

  return null;
}

function serializeDraft(document: PageDocument | null | undefined): string {
  return JSON.stringify(document ? cloneDocument(document) : EMPTY_DOCUMENT);
}

function serializePublished(document: PageDocument | null | undefined): string | null {
  if (!document) {
    return null;
  }

  return JSON.stringify(cloneDocument(document));
}

export interface PageTranslationRecord {
  id: string;
  pageId: string;
  locale: Locale;
  title: string;
  slug: string | null;
  description: string | null;
  draftDocument: PageDocument;
  publishedDocument: PageDocument | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageRecord {
  id: string;
  slug: string;
  title: string;
  status: PageStatus;
  visibility: PageVisibility;
  template: string | null;
  campusId: string | null;
  createdAt: string;
  updatedAt: string;
  translations: PageTranslationRecord[];
}

export interface PublishedPage {
  page: PageRecord;
  translation: PageTranslationRecord;
  document: PageDocument;
}

function normalizeTranslation(row: PageTranslations): PageTranslationRecord {
  const draft = decodeDocument((row as unknown as { draft_document?: unknown }).draft_document);
  const published = decodeDocument((row as unknown as { puck_document?: unknown }).puck_document);

  return {
    id: row.$id,
    pageId: (row as unknown as { page_id?: string }).page_id ?? (row as unknown as { page?: { $id: string } }).page?.$id ?? "",
    locale: row.locale,
    title: row.title,
    slug: (row as unknown as { slug?: string | null }).slug ?? null,
    description: (row as unknown as { description?: string | null }).description ?? null,
    draftDocument: ensureDocument(draft ?? published),
    publishedDocument: published ? cloneDocument(published) : null,
    isPublished: !!(row as unknown as { is_published?: boolean }).is_published,
    publishedAt: (row as unknown as { published_at?: string | null }).published_at ?? null,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}

function normalizePage(row: Pages): PageRecord {
  const translations = Array.isArray((row as unknown as { translation_refs?: PageTranslations[] }).translation_refs)
    ? ((row as unknown as { translation_refs?: PageTranslations[] }).translation_refs ?? []).map(normalizeTranslation)
    : [];

  return {
    id: row.$id,
    slug: row.slug,
    title: (row as unknown as { title?: string }).title ?? "",
    status: row.status as PageStatus,
    visibility: row.visibility as PageVisibility,
    template: (row as unknown as { template?: string | null }).template ?? null,
    campusId: (row as unknown as { campus_id?: string | null }).campus_id ?? null,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
    translations,
  };
}

async function fetchPageRow(pageId: string) {
  const { db } = await createAdminClient();

  return db.getRow<Pages>({
    databaseId: DATABASE_ID,
    tableId: PAGES_TABLE_ID,
    rowId: pageId,
    queries: [Query.select(PAGE_SELECT_FIELDS)],
  });
}

async function fetchTranslationRow(translationId: string) {
  const { db } = await createAdminClient();

  return db.getRow<PageTranslations>({
    databaseId: DATABASE_ID,
    tableId: PAGE_TRANSLATIONS_TABLE_ID,
    rowId: translationId,
  });
}

export interface ListPagesParams {
  search?: string;
  status?: PageStatus[];
  visibility?: PageVisibility[];
  limit?: number;
  campusId?: string | null;
}

export async function listPages(params: ListPagesParams = {}): Promise<PageRecord[]> {
  const { db } = await createAdminClient();

  const queries = [
    Query.select(PAGE_SELECT_FIELDS),
    Query.orderDesc("$updatedAt"),
  ];

  if (typeof params.limit === "number") {
    queries.push(Query.limit(params.limit));
  }

  if (params.search) {
    queries.push(Query.search("title", params.search));
  }

  if (params.status?.length) {
    queries.push(Query.equal("status", params.status));
  }

  if (params.visibility?.length) {
    queries.push(Query.equal("visibility", params.visibility));
  }

  if (params.campusId) {
    queries.push(Query.equal("campus_id", params.campusId));
  }

  const response = await db.listRows<Pages>({
    databaseId: DATABASE_ID,
    tableId: PAGES_TABLE_ID,
    queries,
  });

  return response.rows.map(normalizePage);
}

export async function getPageById(pageId: string): Promise<PageRecord | null> {
  try {
    const page = await fetchPageRow(pageId);
    return normalizePage(page);
  } catch {
    return null;
  }
}

export interface GetPageBySlugParams {
  slug: string;
  locale: Locale;
  preview?: boolean;
}

export async function getPublishedPage({ slug, locale, preview = false }: GetPageBySlugParams): Promise<PublishedPage | null> {
  const { db } = await createSessionClient();

  const response = await db.listRows<Pages>({
    databaseId: DATABASE_ID,
    tableId: PAGES_TABLE_ID,
    queries: [
      Query.equal("slug", slug),
      Query.limit(1),
      Query.select(PAGE_SELECT_FIELDS),
    ],
  });

  const row = response.rows[0];

  if (!row) {
    return null;
  }

  const page = normalizePage(row);
  const translation = page.translations.find((item) => item.locale === locale);

  if (!translation) {
    return null;
  }

  if (!preview) {
    if (page.status !== PageStatus.PUBLISHED) {
      return null;
    }

    if (!translation.isPublished) {
      return null;
    }
  }

  const baseDocument = preview
    ? translation.draftDocument ?? translation.publishedDocument
    : translation.publishedDocument;

  if (!baseDocument) {
    return null;
  }

  return {
    page,
    translation,
    document: cloneDocument(baseDocument),
  };
}

export interface CreatePageTranslationInput {
  locale: Locale;
  title: string;
  slug?: string | null;
  description?: string | null;
  draftDocument?: PageDocument | null;
  publish?: boolean;
}

export interface CreatePageInput {
  slug: string;
  title: string;
  status?: PageStatus;
  visibility?: PageVisibility;
  template?: string | null;
  campusId?: string | null;
  translations: CreatePageTranslationInput[];
}

export async function createPage(input: CreatePageInput): Promise<PageRecord> {
  const { db } = await createAdminClient();

  const pageId = ID.unique();
  const pageStatus = input.status ?? PageStatus.DRAFT;
  const pageVisibility = input.visibility ?? PageVisibility.PUBLIC;

  await db.createRow<Pages>({
    databaseId: DATABASE_ID,
    tableId: PAGES_TABLE_ID,
    rowId: pageId,
    data: {
      slug: input.slug,
      title: input.title,
      status: pageStatus,
      visibility: pageVisibility,
      template: input.template ?? null,
      campus_id: input.campusId ?? null,
    },
  });

  for (const translation of input.translations) {
    const translationId = ID.unique();
    const draftDocument = translation.draftDocument ?? null;
    const publishedDocument = translation.publish ? draftDocument : null;

    await db.createRow<PageTranslations>({
      databaseId: DATABASE_ID,
      tableId: PAGE_TRANSLATIONS_TABLE_ID,
      rowId: translationId,
      data: {
        page_id: pageId,
        page: pageId,
        locale: translation.locale,
        title: translation.title,
        slug: translation.slug ?? null,
        description: translation.description ?? null,
        draft_document: serializeDraft(draftDocument),
        puck_document: serializePublished(publishedDocument),
        is_published: !!translation.publish,
        published_at: translation.publish ? new Date().toISOString() : null,
      },
    });
  }

  return (await getPageById(pageId))!;
}

export interface UpdatePageInput {
  pageId: string;
  slug?: string;
  title?: string;
  status?: PageStatus;
  visibility?: PageVisibility;
  template?: string | null;
  campusId?: string | null;
}

export async function updatePage({ pageId, ...changes }: UpdatePageInput): Promise<PageRecord> {
  const { db } = await createAdminClient();
  const data: Record<string, unknown> = {};

  if (changes.slug !== undefined) data.slug = changes.slug;
  if (changes.title !== undefined) data.title = changes.title;
  if (changes.status !== undefined) data.status = changes.status;
  if (changes.visibility !== undefined) data.visibility = changes.visibility;
  if (changes.template !== undefined) data.template = changes.template;
  if (changes.campusId !== undefined) data.campus_id = changes.campusId;

  if (Object.keys(data).length > 0) {
    await db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PAGES_TABLE_ID,
      rowId: pageId,
      data,
    });
  }

  return (await getPageById(pageId))!;
}

export interface UpdatePageTranslationDraftInput {
  translationId: string;
  title?: string;
  slug?: string | null;
  description?: string | null;
  draftDocument?: PageDocument | null;
}

export async function updatePageTranslationDraft({
  translationId,
  title,
  slug,
  description,
  draftDocument,
}: UpdatePageTranslationDraftInput): Promise<PageTranslationRecord> {
  const { db } = await createAdminClient();
  const data: Record<string, unknown> = {};

  if (title !== undefined) data.title = title;
  if (slug !== undefined) data.slug = slug;
  if (description !== undefined) data.description = description;
  if (draftDocument !== undefined) data.draft_document = serializeDraft(draftDocument);

  if (Object.keys(data).length > 0) {
    await db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PAGE_TRANSLATIONS_TABLE_ID,
      rowId: translationId,
      data,
    });
  }

  const updated = await fetchTranslationRow(translationId);
  return normalizeTranslation(updated);
}

export interface PublishPageTranslationInput {
  translationId: string;
  document?: PageDocument | null;
  title?: string;
  slug?: string | null;
  description?: string | null;
  pageStatus?: PageStatus;
}

export async function publishPageTranslation({
  translationId,
  document,
  title,
  slug,
  description,
  pageStatus,
}: PublishPageTranslationInput): Promise<PageTranslationRecord> {
  const { db } = await createAdminClient();
  const translationRow = await fetchTranslationRow(translationId);

  const baseDraft = decodeDocument((translationRow as unknown as { draft_document?: unknown }).draft_document);
  const publishedDocument = document ?? baseDraft ?? decodeDocument((translationRow as unknown as { puck_document?: unknown }).puck_document);
  const data: Record<string, unknown> = {
    is_published: true,
    published_at: new Date().toISOString(),
  };

  if (title !== undefined) data.title = title;
  if (slug !== undefined) data.slug = slug;
  if (description !== undefined) data.description = description;
  if (publishedDocument) {
    data.puck_document = serializePublished(publishedDocument);
    data.draft_document = serializeDraft(publishedDocument);
  }

  await db.updateRow({
    databaseId: DATABASE_ID,
    tableId: PAGE_TRANSLATIONS_TABLE_ID,
    rowId: translationId,
    data,
  });

  if (pageStatus) {
    await db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PAGES_TABLE_ID,
      rowId: translationRow.page_id,
      data: { status: pageStatus },
    });
  }

  const updated = await fetchTranslationRow(translationId);
  return normalizeTranslation(updated);
}

export async function deletePage(pageId: string): Promise<void> {
  const { db } = await createAdminClient();
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: PAGES_TABLE_ID,
    rowId: pageId,
  });
}

export async function deletePageTranslation(translationId: string): Promise<void> {
  const { db } = await createAdminClient();
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: PAGE_TRANSLATIONS_TABLE_ID,
    rowId: translationId,
  });
}

export interface EnsurePageTranslationParams {
  pageId: string;
  locale: Locale;
  title?: string;
  description?: string | null;
  sourceTranslationId?: string;
}

export async function ensurePageTranslation({
  pageId,
  locale,
  title,
  description,
  sourceTranslationId,
}: EnsurePageTranslationParams): Promise<PageTranslationRecord> {
  const { db } = await createAdminClient();

  const existing = await db.listRows<PageTranslations>({
    databaseId: DATABASE_ID,
    tableId: PAGE_TRANSLATIONS_TABLE_ID,
    queries: [
      Query.equal("page_id", pageId),
      Query.equal("locale", locale),
      Query.limit(1),
    ],
  });

  if (existing.rows.length > 0) {
    return normalizeTranslation(existing.rows[0]);
  }

  let baseDocument: PageDocument | null = null;
  let resolvedTitle = title;

  if (sourceTranslationId) {
    try {
      const source = await fetchTranslationRow(sourceTranslationId);
      baseDocument =
        decodeDocument((source as unknown as { draft_document?: unknown }).draft_document) ??
        decodeDocument((source as unknown as { puck_document?: unknown }).puck_document);
    } catch {
      baseDocument = null;
    }
  }

  if (resolvedTitle === undefined) {
    try {
      const page = await fetchPageRow(pageId);
      resolvedTitle = (page as unknown as { title?: string }).title ?? "";
    } catch {
      resolvedTitle = "";
    }
  }

  const translationId = ID.unique();

  const created = await db.createRow<PageTranslations>({
    databaseId: DATABASE_ID,
    tableId: PAGE_TRANSLATIONS_TABLE_ID,
    rowId: translationId,
    data: {
      page_id: pageId,
      page: pageId,
      locale,
      title: resolvedTitle ?? "",
      slug: null,
      description: description ?? null,
      draft_document: serializeDraft(baseDocument),
      puck_document: null,
      is_published: false,
      published_at: null,
    },
  });

  return normalizeTranslation(created);
}
