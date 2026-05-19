import "server-only";

import { ID, Query } from "./index";
import { createSessionClient } from "./server";
import type {
  PageLocale,
  PageStatus,
  Pages,
  PageTranslations,
  PageVisibility,
} from "./types/appwrite";

// Minimal local definition — avoids circular dep with @repo/editor
interface PageMeta {
  accentColor: string;
  department: string;
  description?: string;
  slug: string;
  status: "draft" | "published";
  title: string;
}

export interface PageDoc {
  blocks: unknown[];
  meta: PageMeta;
}

export const PAGE_LOCALES = ["no", "en"] as const;

export type PageEditorLocale = (typeof PAGE_LOCALES)[number];

export interface PageTranslationEditorEntry {
  description?: string;
  draftDocument: PageDoc | null;
  id?: string;
  isPublished: boolean;
  locale: PageEditorLocale;
  publishedAt: string | null;
  publishedDocument: PageDoc | null;
  title: string;
  updatedAt?: string;
}

export type PageTranslationMap = Partial<
  Record<PageEditorLocale, PageTranslationEditorEntry>
>;

export interface PageEditorSharedData {
  campusId: string | null;
  departmentId: string;
  id: string;
  slug: string;
  status: PageStatus;
  visibility: PageVisibility;
}

export interface PageEditorLoadResult {
  availableLocales: PageEditorLocale[];
  page: PageEditorSharedData;
  translations: PageTranslationMap;
}

// Minimal auth context slice needed here — matches UserAuthContext in admin/lib/authorization.ts
export interface PageAuthCtx {
  activeCampusId?: string;
  managedCampusIds: string[];
  resolvedCampusIds: string[];
  roles: string[];
  userId: string;
}

function resolveCampusId(ctx: PageAuthCtx): string | null {
  if (ctx.roles.includes("globaladmin")) {
    return ctx.activeCampusId ?? null;
  }
  if (ctx.managedCampusIds.length > 0) {
    return ctx.managedCampusIds[0];
  }
  if (ctx.resolvedCampusIds.length > 0) {
    return ctx.resolvedCampusIds[0];
  }
  return null;
}

export function pageDocToJson(doc: PageDoc): string {
  return JSON.stringify(doc);
}

export function jsonToPageDoc(json: string | null | undefined): PageDoc | null {
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json) as PageDoc;
  } catch {
    return null;
  }
}

function isPageEditorLocale(
  locale: string | null | undefined
): locale is PageEditorLocale {
  return (PAGE_LOCALES as readonly string[]).includes(locale ?? "");
}

function normalizeDoc({
  doc,
  row,
  translation,
}: {
  doc: PageDoc | null;
  row: Pages;
  translation: PageTranslations;
}): PageDoc | null {
  if (!doc) {
    return null;
  }
  return {
    ...doc,
    meta: {
      ...doc.meta,
      slug: row.slug ?? doc.meta.slug,
      title: translation.title ?? doc.meta.title,
      description: translation.description ?? doc.meta.description,
      department: row.department_id ?? doc.meta.department,
      status: row.status === "archived" ? "draft" : row.status,
    },
  };
}

function toEditorTranslation(
  row: Pages,
  translation: PageTranslations
): PageTranslationEditorEntry | null {
  if (!isPageEditorLocale(translation.locale)) {
    return null;
  }
  const draftDocument = normalizeDoc({
    doc: jsonToPageDoc(translation.draft_document),
    row,
    translation,
  });
  const publishedDocument = normalizeDoc({
    doc: jsonToPageDoc(translation.puck_document),
    row,
    translation,
  });

  return {
    id: translation.$id,
    locale: translation.locale,
    title: translation.title,
    description: translation.description ?? undefined,
    draftDocument,
    publishedDocument,
    isPublished: translation.is_published,
    publishedAt: translation.published_at,
    updatedAt: translation.$updatedAt,
  };
}

function toEditorLoadResult(row: Pages): PageEditorLoadResult {
  const translations: PageTranslationMap = {};
  const translationRows = Array.isArray(row.translation_refs)
    ? row.translation_refs
    : [];

  for (const translation of translationRows) {
    const entry = toEditorTranslation(row, translation);
    if (entry) {
      translations[entry.locale] = entry;
    }
  }

  return {
    page: {
      id: row.$id,
      slug: row.slug ?? "untitled",
      status: row.status,
      visibility: row.visibility,
      departmentId: row.department_id ?? "",
      campusId: row.campus_id,
    },
    translations,
    availableLocales: [...PAGE_LOCALES],
  };
}

function normalizeDocForSave(doc: PageDoc): PageDoc {
  return {
    ...doc,
    meta: {
      ...doc.meta,
      status: doc.meta.status === "published" ? "published" : "draft",
    },
  };
}

async function resolveUniquePageSlug(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  requestedSlug: string
): Promise<string> {
  const baseSlug = requestedSlug.trim() || "untitled";
  let candidate = baseSlug;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const existing = await db.listRows<Pages>("app", "pages", [
      Query.equal("slug", candidate),
      Query.limit(1),
    ]);

    if (!existing.rows[0]) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
  }

  throw new Error(`Could not find an available slug for "${baseSlug}"`);
}

export async function getPage(
  slug: string,
  locale: PageEditorLocale = "no"
): Promise<{
  row: Pages;
  translation: PageTranslations | null;
  doc: PageDoc | null;
} | null> {
  const { db } = await createSessionClient();

  const res = await db.listRows<Pages>("app", "pages", [
    Query.equal("slug", slug),
    Query.select(["*", "translation_refs.*"]),
    Query.limit(1),
  ]);

  const row = res.rows[0];
  if (!row) {
    return null;
  }

  const translation =
    row.translation_refs?.find((item) => item.locale === locale) ?? null;
  const doc = translation
    ? normalizeDoc({
        doc: jsonToPageDoc(
          translation.puck_document ?? translation.draft_document
        ),
        row,
        translation,
      })
    : null;

  return { row, translation, doc };
}

export async function getPageById(
  id: string,
  locale: PageEditorLocale = "no"
): Promise<{
  row: Pages;
  translation: PageTranslations | null;
  doc: PageDoc | null;
} | null> {
  const result = await getPageEditorById(id);
  if (!result) {
    return null;
  }
  const translation = result.translations[locale] ?? null;
  return {
    row: {
      $id: result.page.id,
      slug: result.page.slug,
      campus_id: result.page.campusId,
      status: result.page.status,
      visibility: result.page.visibility,
      department_id: result.page.departmentId,
      translation_refs: [],
    } as unknown as Pages,
    translation: translation
      ? ({
          $id: translation.id,
          locale: translation.locale,
          title: translation.title,
          description: translation.description ?? null,
          draft_document: translation.draftDocument
            ? pageDocToJson(translation.draftDocument)
            : null,
          puck_document: translation.publishedDocument
            ? pageDocToJson(translation.publishedDocument)
            : null,
          is_published: translation.isPublished,
          published_at: translation.publishedAt,
        } as PageTranslations)
      : null,
    doc: translation?.publishedDocument ?? translation?.draftDocument ?? null,
  };
}

export async function getPageEditorById(
  id: string
): Promise<PageEditorLoadResult | null> {
  const { db } = await createSessionClient();

  const res = await db.listRows<Pages>("app", "pages", [
    Query.equal("$id", id),
    Query.select(["*", "translation_refs.*"]),
    Query.limit(1),
  ]);

  const row = res.rows[0];
  if (!row) {
    return null;
  }
  return toEditorLoadResult(row);
}

export async function savePageDraft({
  id,
  doc,
  locale = "no",
  ctx,
}: {
  id: string | null;
  doc: PageDoc;
  locale?: PageEditorLocale;
  ctx: PageAuthCtx;
}): Promise<{ pageId: string; slug: string; translationId: string }> {
  const { db } = await createSessionClient();
  const campusId = resolveCampusId(ctx);
  let normalizedDoc = normalizeDocForSave(doc);

  let pageId: string;

  if (id) {
    // Update existing page row
    await db.updateRow("app", "pages", id, {
      slug: normalizedDoc.meta.slug,
      status: normalizedDoc.meta.status as PageStatus,
      department_id: normalizedDoc.meta.department || null,
      campus_id: campusId,
    });
    pageId = id;
  } else {
    const uniqueSlug = await resolveUniquePageSlug(db, normalizedDoc.meta.slug);
    normalizedDoc = {
      ...normalizedDoc,
      meta: { ...normalizedDoc.meta, slug: uniqueSlug },
    };
    // Create new page row
    const created = await db.createRow("app", "pages", ID.unique(), {
      slug: normalizedDoc.meta.slug,
      status: "draft" as PageStatus,
      visibility: "public",
      department_id: normalizedDoc.meta.department || null,
      campus_id: campusId,
    });
    pageId = created.$id;
  }

  const json = pageDocToJson(normalizedDoc);

  // Upsert translation row
  const tRes = await db.listRows<PageTranslations>("app", "page_translations", [
    Query.equal("page_id", pageId),
    Query.equal("locale", locale as PageLocale),
    Query.limit(1),
  ]);

  let translationId: string;

  if (tRes.rows[0]) {
    translationId = tRes.rows[0].$id;
    await db.updateRow("app", "page_translations", translationId, {
      draft_document: json,
      title: normalizedDoc.meta.title,
      description: normalizedDoc.meta.description ?? null,
    });
  } else {
    const created = await db.createRow(
      "app",
      "page_translations",
      ID.unique(),
      {
        page_id: pageId,
        page: pageId,
        locale: locale as PageLocale,
        title: normalizedDoc.meta.title,
        description: normalizedDoc.meta.description ?? null,
        draft_document: json,
        is_published: false,
      }
    );
    translationId = created.$id;
  }

  return { pageId, slug: normalizedDoc.meta.slug, translationId };
}

export async function publishPage({
  id,
  locale = "no",
}: {
  id: string;
  locale?: "no" | "en";
}): Promise<void> {
  const { db } = await createSessionClient();

  const tRes = await db.listRows<PageTranslations>("app", "page_translations", [
    Query.equal("page_id", id),
    Query.equal("locale", locale as PageLocale),
    Query.limit(1),
  ]);

  const translation = tRes.rows[0];
  if (!translation) {
    throw new Error("No translation found to publish");
  }

  await db.updateRow("app", "page_translations", translation.$id, {
    puck_document: translation.draft_document,
    is_published: true,
    published_at: new Date().toISOString(),
  });

  await db.updateRow("app", "pages", id, {
    status: "published" as PageStatus,
  });
}

export async function unpublishPage({
  id,
  locale = "no",
}: {
  id: string;
  locale?: "no" | "en";
}): Promise<void> {
  const { db } = await createSessionClient();

  const tRes = await db.listRows<PageTranslations>("app", "page_translations", [
    Query.equal("page_id", id),
    Query.equal("locale", locale as PageLocale),
    Query.limit(1),
  ]);

  const translation = tRes.rows[0];
  if (translation) {
    await db.updateRow("app", "page_translations", translation.$id, {
      is_published: false,
    });
  }

  await db.updateRow("app", "pages", id, {
    status: "draft" as PageStatus,
  });
}
