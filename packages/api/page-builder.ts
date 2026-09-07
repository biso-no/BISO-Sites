import { ID, Permission, Query, Role } from "./index";
import { createAdminClient, createSessionClient } from "./server";
import type {
  Pages,
  PageTranslations,
  PageTranslationsLocale,
} from "./types/appwrite";
import { PagesStatus, PagesVisibility } from "./types/appwrite";

const MEMBERS_TEAM = "biso-members";

/**
 * Build Appwrite $permissions for a page or page_translations row.
 *
 * Row permissions describe CONSUMER visibility only — authoring goes through
 * the admin client behind application-level authorization, so no team ever
 * receives row-level write access:
 *  - published + public → `read(any)`;
 *  - published + members → members-team read;
 *  - anything else (draft/archived, unpublished translation) → no
 *    permissions; the row is service-only.
 */
function buildPageRowPermissions(opts: {
  isPublished: boolean;
  audience: "public" | "members";
}): string[] {
  const { isPublished, audience } = opts;
  if (!isPublished) {
    return [];
  }
  return audience === "members"
    ? [Permission.read(Role.team(MEMBERS_TEAM))]
    : [Permission.read(Role.any())];
}

function pageAudience(visibility: PagesVisibility): "public" | "members" {
  return visibility === PagesVisibility.AUTHENTICATED ? "members" : "public";
}

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
  status: PagesStatus;
  visibility: PagesVisibility;
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

/**
 * The campus a page save will be attributed to for this author. Exported so
 * the admin action can authorize the requested scope before persisting.
 */
export function resolvePageCampusId(ctx: PageAuthCtx): string | null {
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

/** Normalize an Appwrite relationship value (row object or ID) to its ID. */
function relatedId(
  value: string | { $id: string } | null | undefined
): string | null {
  return typeof value === "string" ? value : (value?.$id ?? null);
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
      // Relationship ownership is canonical; scalar columns remain as
      // migration-era compatibility metadata for pre-backfill rows.
      departmentId: relatedId(row.department) ?? row.department_id ?? "",
      campusId: relatedId(row.campus) ?? row.campus_id,
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
  locale: PageEditorLocale = "no",
  dbOverride?: Awaited<ReturnType<typeof createSessionClient>>["db"]
): Promise<{
  row: Pages;
  translation: PageTranslations | null;
  doc: PageDoc | null;
} | null> {
  const db = dbOverride ?? (await createSessionClient()).db;

  const res = await db.listRows<Pages>("app", "pages", [
    Query.equal("slug", slug),
    // `status` and `department_id` are read by normalizeDoc below. Without
    // them in the projection they arrive undefined, which left every page's
    // `meta.status` undefined and made `meta.department` — the value the
    // auto-source blocks resolve their feed from — impossible to correct from
    // the row.
    Query.select([
      "$id",
      "slug",
      "status",
      "department_id",
      "translation_refs.*",
    ]),
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
  locale: PageEditorLocale = "no",
  dbOverride?: PageDatabase
): Promise<{
  row: Pages;
  translation: PageTranslations | null;
  doc: PageDoc | null;
} | null> {
  const result = await getPageEditorById(id, dbOverride);
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

type PageDatabase = Awaited<ReturnType<typeof createSessionClient>>["db"];

export async function getPageEditorById(
  id: string,
  dbOverride?: PageDatabase
): Promise<PageEditorLoadResult | null> {
  const db = dbOverride ?? (await createSessionClient()).db;

  const res = await db.listRows<Pages>("app", "pages", [
    Query.equal("$id", id),
    Query.select(["*", "translation_refs.*", "campus.$id", "department.$id"]),
    Query.limit(1),
  ]);

  const row = res.rows[0];
  if (!row) {
    return null;
  }
  return toEditorLoadResult(row);
}

export async function savePageDraft(params: {
  id: string | null;
  doc: PageDoc;
  locale?: PageEditorLocale;
  ctx: PageAuthCtx;
  /**
   * Explicit campus to persist, overriding the author-derived value. Pass it
   * when the caller already knows the correct campus for this row (e.g. an
   * existing page's own persisted campus on update, or a unit page's
   * department campus on create) — see the presence check below for why an
   * absent property and an explicit `null` are NOT the same thing.
   */
  campusId?: string | null;
  /**
   * How to handle a slug collision on CREATE (`id === null`).
   *
   * - `"suffix"` (default): the historical behavior — probe for a free slug
   *   and silently append `-2`, `-3`, ... Fine for ordinary editor pages,
   *   where any reachable slug is an acceptable outcome.
   * - `"fail"`: skip the suffixing probe entirely and let the write hit the
   *   `page_slug_unique` index as-is. Use this for slugs whose EXACT value is
   *   load-bearing (e.g. unit pages, which are only ever looked up at their
   *   unsuffixed `units/<campus>/<slug>` address — a silently-suffixed
   *   variant would be permanently unreachable). The caller is responsible
   *   for catching the resulting 409 and deciding what it means.
   */
  slugConflict?: "suffix" | "fail";
}): Promise<{ pageId: string; slug: string; translationId: string }> {
  const { id, doc, locale = "no", ctx, slugConflict = "suffix" } = params;
  // PRIVILEGED: callers must authorize the requested scope before invoking
  // this helper; the write goes through the service-key admin client.
  const { db } = await createAdminClient();
  // A property PRESENT with value `null` is a deliberate override (e.g. a
  // national page's legitimate null campus); a property ABSENT means "no
  // override, derive from the author" as before. `params.campusId ??
  // resolvePageCampusId(ctx)` cannot tell those apart — it would silently
  // replace an explicit `null` override with the author's campus, which
  // defeats the whole point of passing one. Check presence explicitly.
  const campusId =
    "campusId" in params ? params.campusId : resolvePageCampusId(ctx);
  let normalizedDoc = normalizeDocForSave(doc);

  if (!id && slugConflict === "suffix") {
    const uniqueSlug = await resolveUniquePageSlug(db, normalizedDoc.meta.slug);
    normalizedDoc = {
      ...normalizedDoc,
      meta: { ...normalizedDoc.meta, slug: uniqueSlug },
    };
  }

  const pageStatus = id
    ? (normalizedDoc.meta.status as PagesStatus)
    : PagesStatus.DRAFT;
  const departmentId = normalizedDoc.meta.department || null;
  const visibility = PagesVisibility.PUBLIC;
  const pagePermissions = buildPageRowPermissions({
    isPublished: pageStatus === PagesStatus.PUBLISHED,
    audience: pageAudience(visibility),
  });

  const page = await db.upsertRow(
    "app",
    "pages",
    id ?? ID.unique(),
    {
      slug: normalizedDoc.meta.slug,
      status: pageStatus,
      visibility,
      // Canonical ownership relationships; the scalar columns remain as
      // migration-era compatibility metadata only.
      campus: campusId,
      campus_id: campusId,
      department: departmentId,
      department_id: departmentId,
    },
    pagePermissions
  );
  const pageId = page.$id;
  const json = pageDocToJson(normalizedDoc);

  // Upsert translation row
  const tRes = await db.listRows<PageTranslations>("app", "page_translations", [
    Query.equal("page_id", pageId),
    Query.equal("locale", locale as PageTranslationsLocale),
    Query.limit(1),
  ]);

  const translationPublished = tRes.rows[0]?.is_published ?? false;
  const translationPermissions = buildPageRowPermissions({
    isPublished: pageStatus === PagesStatus.PUBLISHED && translationPublished,
    audience: pageAudience(visibility),
  });

  const translation = await db.upsertRow<PageTranslations>(
    "app",
    "page_translations",
    tRes.rows[0]?.$id ?? ID.unique(),
    {
      page_id: pageId,
      page: pageId as unknown as Pages,
      locale: locale as PageTranslationsLocale,
      draft_document: json,
      title: normalizedDoc.meta.title,
      description: normalizedDoc.meta.description ?? null,
      is_published: translationPublished,
    },
    translationPermissions
  );

  return {
    pageId,
    slug: normalizedDoc.meta.slug,
    translationId: translation.$id,
  };
}

/**
 * Save one translated draft without mutating the parent page.
 *
 * PRIVILEGED: callers must authorize access before invoking this helper. It is
 * intended for deferred translation work, where the request session may have
 * already completed.
 */
export async function savePageTranslationDraft({
  id,
  doc,
  locale,
}: {
  id: string;
  doc: PageDoc;
  locale: PageEditorLocale;
}): Promise<{ translationId: string }> {
  const { db } = await createAdminClient();
  const pageRes = await db.listRows<Pages>("app", "pages", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const page = pageRes.rows[0];
  if (!page) {
    throw new Error("Page not found");
  }

  const normalizedDoc = normalizeDocForSave(doc);
  const existingRes = await db.listRows<PageTranslations>(
    "app",
    "page_translations",
    [
      Query.equal("page_id", id),
      Query.equal("locale", locale as PageTranslationsLocale),
      Query.limit(1),
    ]
  );
  const existing = existingRes.rows[0];
  const permissions = buildPageRowPermissions({
    isPublished:
      page.status === PagesStatus.PUBLISHED &&
      (existing?.is_published ?? false),
    audience: pageAudience(page.visibility),
  });
  const translation = await db.upsertRow<PageTranslations>(
    "app",
    "page_translations",
    existing?.$id ?? ID.unique(),
    {
      page_id: id,
      page: id as unknown as Pages,
      locale: locale as PageTranslationsLocale,
      draft_document: pageDocToJson(normalizedDoc),
      title: normalizedDoc.meta.title,
      description: normalizedDoc.meta.description ?? null,
      is_published: existing?.is_published ?? false,
    },
    permissions
  );
  return { translationId: translation.$id };
}

/**
 * Publish a page's translation.
 *
 * PRIVILEGED: the row writes use the service-key admin client. Page rows grant
 * update/delete only to Operations Unit and the owning department team (never
 * the campus team, by design — see buildPageRowPermissions), so a legitimate
 * campus approver could not perform this write under RLS. Callers MUST enforce
 * publish authorization (e.g. assertPublishAccess) BEFORE calling this.
 */
export async function publishPage({
  id,
  locale = "no",
  updateParentStatus = true,
}: {
  id: string;
  locale?: "no" | "en";
  updateParentStatus?: boolean;
}): Promise<void> {
  const { db } = await createAdminClient();

  const tRes = await db.listRows<PageTranslations>("app", "page_translations", [
    Query.equal("page_id", id),
    Query.equal("locale", locale as PageTranslationsLocale),
    Query.limit(1),
  ]);

  const translation = tRes.rows[0];
  if (!translation) {
    throw new Error("No translation found to publish");
  }

  const pageRes = await db.listRows<Pages>("app", "pages", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const pageRow = pageRes.rows[0];
  const visibility = pageRow?.visibility ?? PagesVisibility.PUBLIC;
  const publishedPermissions = buildPageRowPermissions({
    isPublished: true,
    audience: pageAudience(visibility),
  });

  await db.updateRow(
    "app",
    "page_translations",
    translation.$id,
    {
      puck_document: translation.draft_document,
      is_published: true,
      published_at: new Date().toISOString(),
    },
    publishedPermissions
  );

  if (updateParentStatus) {
    await db.updateRow(
      "app",
      "pages",
      id,
      {
        status: "published" as PagesStatus,
      },
      publishedPermissions
    );
  }
}

/**
 * Unpublish a page's translation (removes it from the public site).
 *
 * PRIVILEGED: same contract as {@link publishPage} — the row writes use the
 * service-key admin client because campus approvers are not on the page rows'
 * write ACL. Callers MUST enforce publish authorization first.
 */
export async function unpublishPage({
  id,
  locale = "no",
}: {
  id: string;
  locale?: "no" | "en";
}): Promise<void> {
  const { db } = await createAdminClient();

  const tRes = await db.listRows<PageTranslations>("app", "page_translations", [
    Query.equal("page_id", id),
    Query.equal("locale", locale as PageTranslationsLocale),
    Query.limit(1),
  ]);

  const pageRes = await db.listRows<Pages>("app", "pages", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const pageRow = pageRes.rows[0];
  const visibility = pageRow?.visibility ?? PagesVisibility.PUBLIC;
  const draftPermissions = buildPageRowPermissions({
    isPublished: false,
    audience: pageAudience(visibility),
  });

  const translation = tRes.rows[0];
  if (translation) {
    await db.updateRow(
      "app",
      "page_translations",
      translation.$id,
      {
        is_published: false,
      },
      draftPermissions
    );
  }

  await db.updateRow(
    "app",
    "pages",
    id,
    {
      status: "draft" as PagesStatus,
    },
    draftPermissions
  );
}
