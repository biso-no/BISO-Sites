import "server-only";

import { ID, Query } from "./index";
import { createSessionClient } from "./server";
import type { Pages, PageTranslations, PageStatus, PageLocale } from "./types/appwrite";

// Minimal local definition — avoids circular dep with @repo/editor
interface PageMeta {
  title: string;
  slug: string;
  department: string;
  accentColor: string;
  description?: string;
  status: "draft" | "published";
}

export interface PageDoc {
  meta: PageMeta;
  blocks: unknown[];
}

// Minimal auth context slice needed here — matches UserAuthContext in admin/lib/authorization.ts
export interface PageAuthCtx {
  roles: string[];
  activeCampusId?: string;
  managedCampusIds: string[];
  resolvedCampusIds: string[];
  userId: string;
}

function resolveCampusId(ctx: PageAuthCtx): string | null {
  if (ctx.roles.includes("globaladmin")) return ctx.activeCampusId ?? null;
  if (ctx.managedCampusIds.length > 0) return ctx.managedCampusIds[0];
  if (ctx.resolvedCampusIds.length > 0) return ctx.resolvedCampusIds[0];
  return null;
}

export function pageDocToJson(doc: PageDoc): string {
  return JSON.stringify(doc);
}

export function jsonToPageDoc(json: string | null | undefined): PageDoc | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as PageDoc;
  } catch {
    return null;
  }
}

export async function getPage(
  slug: string,
  locale: "no" | "en" = "no"
): Promise<{ row: Pages; translation: PageTranslations | null; doc: PageDoc | null } | null> {
  const { db } = await createSessionClient();

  const res = await db.listRows<Pages>("app", "pages", [
    Query.equal("slug", slug),
    Query.limit(1),
  ]);

  const row = res.rows[0];
  if (!row) return null;

  const tRes = await db.listRows<PageTranslations>("app", "page_translations", [
    Query.equal("page_id", row.$id),
    Query.equal("locale", locale as PageLocale),
    Query.limit(1),
  ]);

  const translation = tRes.rows[0] ?? null;
  const doc = jsonToPageDoc(translation?.puck_document ?? translation?.draft_document ?? null);

  return { row, translation, doc };
}

export async function getPageById(
  id: string,
  locale: "no" | "en" = "no"
): Promise<{ row: Pages; translation: PageTranslations | null; doc: PageDoc | null } | null> {
  const { db } = await createSessionClient();

  const res = await db.listRows<Pages>("app", "pages", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);

  const row = res.rows[0];
  if (!row) return null;

  const tRes = await db.listRows<PageTranslations>("app", "page_translations", [
    Query.equal("page_id", id),
    Query.equal("locale", locale as PageLocale),
    Query.limit(1),
  ]);

  const translation = tRes.rows[0] ?? null;
  const doc = jsonToPageDoc(translation?.puck_document ?? translation?.draft_document ?? null);

  return { row, translation, doc };
}

export async function savePageDraft({
  id,
  doc,
  locale = "no",
  ctx,
}: {
  id: string | null;
  doc: PageDoc;
  locale?: "no" | "en";
  ctx: PageAuthCtx;
}): Promise<{ pageId: string; translationId: string }> {
  const { db } = await createSessionClient();
  const campusId = resolveCampusId(ctx);
  const json = pageDocToJson(doc);

  let pageId: string;

  if (id) {
    // Update existing page row
    await db.updateRow("app", "pages", id, {
      slug: doc.meta.slug,
      title: doc.meta.title,
      status: doc.meta.status as PageStatus,
      department_id: doc.meta.department || null,
      campus_id: campusId,
    });
    pageId = id;
  } else {
    // Create new page row
    const created = await db.createRow("app", "pages", ID.unique(), {
      slug: doc.meta.slug,
      title: doc.meta.title,
      status: "draft" as PageStatus,
      visibility: "public",
      department_id: doc.meta.department || null,
      campus_id: campusId,
    });
    pageId = created.$id;
  }

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
      title: doc.meta.title,
      slug: doc.meta.slug,
      description: doc.meta.description ?? null,
    });
  } else {
    const created = await db.createRow("app", "page_translations", ID.unique(), {
      page_id: pageId,
      page: pageId,
      locale: locale as PageLocale,
      title: doc.meta.title,
      slug: doc.meta.slug,
      description: doc.meta.description ?? null,
      draft_document: json,
      is_published: false,
    });
    translationId = created.$id;
  }

  return { pageId, translationId };
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
  if (!translation) throw new Error("No translation found to publish");

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
