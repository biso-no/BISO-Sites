"use server";

import { migrate } from "@puckeditor/core/rsc";
import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "./server";
import type { Locale, Pages, PageTranslations } from "./types/appwrite";
import { PageStatus, type PageVisibility } from "./types/appwrite";

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

function ensureDocument(
  document: PageDocument | null | undefined
): PageDocument {
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

function maybeMigrateDocument(
  document: PageDocument | null
): PageDocument | null {
  if (!document) {
    return null;
  }

  const maybe = document as unknown as { content?: unknown };
  if (!Array.isArray(maybe.content)) {
    return document;
  }

  try {
    return migrate(document as any) as unknown as PageDocument;
  } catch {
    return document;
  }
}

function serializeDraft(document: PageDocument | null | undefined): string {
  return JSON.stringify(document ? cloneDocument(document) : EMPTY_DOCUMENT);
}

function serializePublished(
  document: PageDocument | null | undefined
): string | null {
  if (!document) {
    return null;
  }

  return JSON.stringify(cloneDocument(document));
}

export type PageTranslationRecord = {
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
};

export type PageRecord = {
  id: string;
  slug: string;
  title: string;
  status: PageStatus;
  visibility: PageVisibility;
  template: string | null;
  campusId: string | null;
  departmentId: string | null;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  translations: PageTranslationRecord[];
};

export type PublishedPage = {
  page: PageRecord;
  translation: PageTranslationRecord;
  document: PageDocument;
};

async function hasAuthenticatedSession(): Promise<boolean> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    const hasEmail = typeof user.email === "string" && user.email.length > 0;
    const hasRealName =
      typeof user.name === "string" &&
      user.name.length > 0 &&
      !user.name.startsWith("guest_");

    return hasEmail || (hasRealName && !!user.emailVerification);
  } catch {
    return false;
  }
}

function normalizeTranslation(row: PageTranslations): PageTranslationRecord {
  const draft = maybeMigrateDocument(
    decodeDocument(
      (row as unknown as { draft_document?: unknown }).draft_document
    )
  );
  const published = maybeMigrateDocument(
    decodeDocument(
      (row as unknown as { puck_document?: unknown }).puck_document
    )
  );

  const draftDocument = ensureDocument(draft ?? published);
  const publishedDocument = published ? cloneDocument(published) : null;

  return {
    id: row.$id,
    pageId:
      (row as unknown as { page_id?: string }).page_id ??
      (row as unknown as { page?: { $id: string } }).page?.$id ??
      "",
    locale: row.locale,
    title: row.title,
    slug: (row as unknown as { slug?: string | null }).slug ?? null,
    description:
      (row as unknown as { description?: string | null }).description ?? null,
    draftDocument,
    publishedDocument,
    isPublished: !!(row as unknown as { is_published?: boolean }).is_published,
    publishedAt:
      (row as unknown as { published_at?: string | null }).published_at ?? null,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}

function normalizePage(row: Pages): PageRecord {
  const translations = Array.isArray(
    (row as unknown as { translation_refs?: PageTranslations[] })
      .translation_refs
  )
    ? (
        (row as unknown as { translation_refs?: PageTranslations[] })
          .translation_refs ?? []
      ).map(normalizeTranslation)
    : [];

  return {
    id: row.$id,
    slug: row.slug,
    title: (row as unknown as { title?: string }).title ?? "",
    status: row.status as PageStatus,
    visibility: row.visibility as PageVisibility,
    template: (row as unknown as { template?: string | null }).template ?? null,
    campusId:
      (row as unknown as { campus_id?: string | null }).campus_id ?? null,
    departmentId:
      (row as unknown as { department_id?: string | null }).department_id ??
      null,
    permissions:
      (row as unknown as { $permissions?: string[] }).$permissions ?? [],
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

export type ListPagesParams = {
  search?: string;
  status?: PageStatus[];
  visibility?: PageVisibility[];
  limit?: number;
  campusId?: string | null;
  departmentId?: string | null;
  /** Use session client instead of admin client (respects RLS) */
  useSession?: boolean;
};

export async function listPages(
  params: ListPagesParams = {}
): Promise<PageRecord[]> {
  const { db } = params.useSession
    ? await createSessionClient()
    : await createAdminClient();

  // Include $permissions in select fields
  const selectFields = [...PAGE_SELECT_FIELDS, "$permissions"];

  const queries = [Query.select(selectFields), Query.orderDesc("$updatedAt")];

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

  if (params.departmentId) {
    queries.push(Query.equal("department_id", params.departmentId));
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

export type GetPageBySlugParams = {
  slug: string;
  locale: Locale;
  preview?: boolean;
};

export async function getPublishedPage({
  slug,
  locale,
  preview = false,
}: GetPageBySlugParams): Promise<PublishedPage | null> {
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

    if (
      page.visibility === "authenticated" &&
      !(await hasAuthenticatedSession())
    ) {
      return null;
    }
  }

  const baseDocument = preview
    ? (translation.draftDocument ?? translation.publishedDocument)
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

export type UpdatePageInput = {
  pageId: string;
  slug?: string;
  title?: string;
  status?: PageStatus;
  visibility?: PageVisibility;
  template?: string | null;
  campusId?: string | null;
};

export async function updatePage({
  pageId,
  ...changes
}: UpdatePageInput): Promise<PageRecord> {
  const { db } = await createAdminClient();
  const data: Record<string, unknown> = {};

  if (changes.slug !== undefined) {
    data.slug = changes.slug;
  }
  if (changes.title !== undefined) {
    data.title = changes.title;
  }
  if (changes.status !== undefined) {
    data.status = changes.status;
  }
  if (changes.visibility !== undefined) {
    data.visibility = changes.visibility;
  }
  if (changes.template !== undefined) {
    data.template = changes.template;
  }
  if (changes.campusId !== undefined) {
    data.campus_id = changes.campusId;
  }

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

export async function deletePage(pageId: string): Promise<void> {
  const { db } = await createAdminClient();
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: PAGES_TABLE_ID,
    rowId: pageId,
  });
}

export type UpsertPageTranslationData = {
  locale: Locale;
  title: string;
  slug?: string | null;
  description?: string | null;
  draftDocument: PageDocument;
  publish: boolean;
};

export type UpsertPageInput = {
  pageId?: string;
  slug: string;
  title: string;
  status: PageStatus;
  visibility: PageVisibility;
  template?: string | null;
  campusId?: string | null;
  departmentId?: string | null;
  permissions?: string[];
  translations: UpsertPageTranslationData[];
};

export async function upsertPage(input: UpsertPageInput): Promise<PageRecord> {
  const { db } = await createSessionClient();

  const pageId = input.pageId ?? ID.unique();

  const existingTranslations: Map<Locale, string> = new Map();

  if (input.pageId) {
    const existingPage = await getPageById(input.pageId);
    if (existingPage) {
      for (const translation of existingPage.translations) {
        existingTranslations.set(translation.locale, translation.id);
      }
    }
  }

  const translationRefs = input.translations.map((translation) => {
    const publishedDocument = translation.publish
      ? translation.draftDocument
      : null;

    const translationData: Record<string, unknown> = {
      locale: translation.locale,
      title: translation.title,
      slug: translation.slug ?? null,
      description: translation.description ?? null,
      draft_document: serializeDraft(translation.draftDocument),
      puck_document: serializePublished(publishedDocument),
      is_published: translation.publish,
      published_at: translation.publish ? new Date().toISOString() : null,
      page_id: pageId,
      page: pageId,
    };

    const existingId = existingTranslations.get(translation.locale);
    if (existingId) {
      translationData.$id = existingId;
    }

    if (input.permissions) {
      translationData.$permissions = input.permissions;
    }

    return translationData;
  });
  /* Published document structure:
  {"root":{"props":{"publishMode":"now","title":"Velkommen","slug":"velkommen","description":"","campus":"5","departmentId":"1003","contentType":"department-listing","id":"root"},"type":"root"},"content":[{"type":"Hero","props":{"layout":"split","height":"medium","title":"Velkommen til vår avdeling","subtitle":"Fremhev hva vi gjør og hva som skjer akkurat nå.","buttons":[{"label":"Bli med oss","href":"/join","variant":"gradient"},{"label":"Kontakt","href":"/contact","variant":"outline"}],"overlay":true,"slides":[],"slidesMode":"manual","stats":[],"statsMode":"manual","highlights":[],"id":"Hero-b03dff31-18c0-4855-92cd-7fcbf5e3eaa5"}},{"type":"FeatureGrid","props":{"columns":3,"variant":"icon","align":"center","items":[{"title":"Bygg fellesskap","description":"Skap arenaer der studenter kan møtes og blomstre.","icon":"Users"},{"title":"Hold arrangementer","description":"Organiser minneverdige opplevelser hele året.","icon":"Calendar"},{"title":"Skap muligheter","description":"Prosjekter, partnere og karriereutvikling.","icon":"Briefcase"}],"title":"Dette gjør vi","subtitle":"Et par raske høydepunkter som introduserer teamet.","id":"FeatureGrid-43f845ac-41a9-439c-852d-362d95abf58f"}},{"type":"Events","props":{"dataMode":"dynamic","scope":"page","dataSource":{"table":"events","limit":6,"sort":{"field":"start_date","direction":"asc"},"filters":[{"field":"start_date","operator":"greaterThan","value":"$now"},{"field":"status","operator":"equal","value":"published"}]},"events":[],"labels":{"empty":"Ingen arrangementer","emptyDescription":"Kom tilbake senere","upcomingEvents":"Kommende arrangementer","dontMissOut":"Ikke gå glipp av","amazingExperiences":"fantastiske opplevelser","description":"Bli med oss på arrangementene våre.","registerNow":"Meld deg på nå","viewAllEvents":"Se alle arrangementer"},"id":"Events-3cce7259-bf9d-40db-82da-538e98d87fc7"},"readOnly":{"events":true}},{"type":"News","props":{"dataMode":"dynamic","scope":"page","dataSource":{"table":"news","limit":6,"sort":{"field":"$createdAt","direction":"desc"},"filters":[{"field":"status","operator":"equal","value":"published"}]},"news":[],"labels":{"empty":"Ingen nyheter ennå","emptyDescription":"Kom tilbake senere.","cta":"Oppdater","stayUpdated":"Hold deg","titleDefault":"oppdatert","readMore":"Les mer","viewAllNews":"Se alle nyheter"},"id":"News-afd90797-48f8-4ae8-a1f1-4e65c5a09b8d"},"readOnly":{"news":true}},{"type":"CTA","props":{"title":"Vil du engasjere deg?","description":"Bli en del av teamet og bidra til å forme fellesskapet.","variant":"brand","buttons":[{"label":"Søk nå","href":"/jobs","variant":"secondary"}],"align":"center","id":"CTA-1a613bc1-1313-473c-ad46-f6ae962ba12f"}}],"zones":{}}
  */
  //Extract departmentId from translations (they should all be the same)
  const departmentId =
    (
      input.translations[0]?.draftDocument?.root as
        | { props?: { departmentId?: string | null } }
        | undefined
    )?.props?.departmentId ?? null;

  const campusId =
    (
      input.translations[0]?.draftDocument?.root as
        | { props?: { campus?: string | null } }
        | undefined
    )?.props?.campus ?? null;

  await db.upsertRow({
    databaseId: DATABASE_ID,
    tableId: PAGES_TABLE_ID,
    rowId: pageId,
    data: {
      slug: input.slug,
      title: input.title,
      status: input.status,
      visibility: input.visibility,
      template: input.template ?? null,
      campus_id: campusId,
      department_id: departmentId,
      translation_refs: translationRefs,
    },
    permissions: input.permissions,
  });

  return (await getPageById(pageId))!;
}
