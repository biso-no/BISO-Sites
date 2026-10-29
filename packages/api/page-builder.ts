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
export function buildPageRowPermissions(opts: {
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

export function pageAudience(
  visibility: PagesVisibility
): "public" | "members" {
  return visibility === PagesVisibility.AUTHENTICATED ? "members" : "public";
}

// Minimal local definition — avoids circular dep with @repo/editor
interface PageMeta {
  /** Campus id the page belongs to; "" for national. Absent on older documents. */
  campus?: string;
  department: string;
  description?: string;
  slug: string;
  status: "draft" | "published";
  /** Colour theme: absent follows the department, `null` resets to BISO. */
  theme?: { accent: string; dark: string } | null;
  title: string;
}

export interface PageDoc {
  /** The page header (`PageHeader` in @repo/editor); absent on most pages. */
  header?: unknown;
  meta: PageMeta;
  sections: unknown[];
  version: 2;
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
    doc: jsonToPageDoc(translation.draft_doc),
    row,
    translation,
  });
  const publishedDocument = normalizeDoc({
    doc: jsonToPageDoc(translation.published_doc),
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

/**
 * Public read of a page by slug: the row, the locale's translation and its
 * published document. `doc` is null when that locale has nothing published.
 */
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
      // The form route tells a members-only page from a missing one by this.
      "visibility",
      "department_id",
      // Form submissions inherit the page's campus.
      "campus_id",
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
  // The published document only, never the draft. Legacy translations are
  // `is_published` with no `published_doc`; once opened in the editor they
  // gain a `draft_doc`, and falling back to it would put unpublished edits on
  // the public site.
  const doc = translation
    ? normalizeDoc({
        doc: jsonToPageDoc(translation.published_doc),
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
          draft_doc: translation.draftDocument
            ? pageDocToJson(translation.draftDocument)
            : null,
          published_doc: translation.publishedDocument
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

  const departmentId = normalizedDoc.meta.department || null;
  const ownership = {
    slug: normalizedDoc.meta.slug,
    // Canonical ownership relationships; the scalar columns remain as
    // migration-era compatibility metadata only.
    campus: campusId,
    campus_id: campusId,
    department: departmentId,
    department_id: departmentId,
  };

  // A save never writes the publish state: the page's status, the read
  // permissions that follow it, and a translation's is_published belong to
  // publishPage and unpublishPage. A save read nothing of them, so writing
  // its idea of them back would undo a publish or unpublish that landed
  // while it was on its way. A new page starts as an unpublished draft.
  let pageId: string;
  if (id) {
    await db.updateRow("app", "pages", id, ownership);
    pageId = id;
  } else {
    const visibility = PagesVisibility.PUBLIC;
    const page = await db.upsertRow(
      "app",
      "pages",
      ID.unique(),
      { ...ownership, status: PagesStatus.DRAFT, visibility },
      buildPageRowPermissions({
        isPublished: false,
        audience: pageAudience(visibility),
      })
    );
    pageId = page.$id;
  }

  const { translationId } = await writeTranslationDraft(db, {
    doc: normalizedDoc,
    locale,
    pageId,
  });

  return { pageId, slug: normalizedDoc.meta.slug, translationId };
}

/** The translation row a draft write produced. */
interface TranslationDraftWrite {
  translationId: string;
  /** The row's `$updatedAt` after this write. */
  updatedAt: string;
}

/**
 * Store `doc` as the draft of the page's `locale` translation. An existing
 * row gets the draft, title and description only, so its publish state and
 * permissions stay as publishing left them; a new row starts unpublished.
 */
async function writeTranslationDraft(
  db: PageDatabase,
  {
    doc,
    locale,
    pageId,
  }: { doc: PageDoc; locale: PageEditorLocale; pageId: string }
): Promise<TranslationDraftWrite> {
  const existing = await db.listRows<PageTranslations>(
    "app",
    "page_translations",
    [
      Query.equal("page_id", pageId),
      Query.equal("locale", locale as PageTranslationsLocale),
      Query.limit(1),
    ]
  );
  const draft = {
    draft_doc: pageDocToJson(doc),
    title: doc.meta.title,
    description: doc.meta.description ?? null,
  };
  const row = existing.rows[0];
  if (row) {
    const updated = await db.updateRow<PageTranslations>(
      "app",
      "page_translations",
      row.$id,
      draft
    );
    return { translationId: row.$id, updatedAt: updated?.$updatedAt };
  }
  const created = await db.upsertRow<PageTranslations>(
    "app",
    "page_translations",
    ID.unique(),
    {
      ...draft,
      page_id: pageId,
      page: pageId as unknown as Pages,
      locale: locale as PageTranslationsLocale,
      is_published: false,
    },
    buildPageRowPermissions({ isPublished: false, audience: "public" })
  );
  return { translationId: created.$id, updatedAt: created.$updatedAt };
}

/**
 * Save one translated draft without mutating the parent page. Returns the
 * row's `$updatedAt` after the write, so a caller that publishes next can
 * tell whether anyone wrote the locale in between.
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
}): Promise<TranslationDraftWrite> {
  const { db } = await createAdminClient();
  const pageRes = await db.listRows<Pages>("app", "pages", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const page = pageRes.rows[0];
  if (!page) {
    throw new Error("Page not found");
  }

  return await writeTranslationDraft(db, {
    doc: normalizeDocForSave(doc),
    locale,
    pageId: id,
  });
}

/** A page has one translation row per locale; this covers them with room. */
const TRANSLATION_ROWS_LIMIT = 25;

async function listPageTranslations(
  db: PageDatabase,
  id: string
): Promise<PageTranslations[]> {
  const res = await db.listRows<PageTranslations>("app", "page_translations", [
    Query.equal("page_id", id),
    Query.limit(TRANSLATION_ROWS_LIMIT),
  ]);
  return res.rows;
}

/**
 * Write the meta every locale shares into each OTHER locale's stored draft of
 * a page, so a theme (or slug, department …) saved in one locale is what the
 * other locale's Publish copies live. `meta` holds exactly the shared fields,
 * chosen by the caller; one that is undefined is removed from the drafts, and
 * `null` is kept. Only drafts that exist are touched: no translation row is
 * created, and a draft that already holds these values is not rewritten.
 *
 * Each draft is re-read just before it is written: another tab may have
 * saved that locale since the list was read, and writing the listed copy
 * back would undo its edit. When the row changed, the shared meta is merged
 * into the newer draft and the write retried once; when it changed again, the
 * write is skipped with a warning (that tab's next save carries the shared
 * meta anyway). Appwrite has no conditional update, so a write landing
 * between the last re-read and this write can still be overwritten: the
 * window is that one round trip, not the whole sync.
 *
 * PRIVILEGED: writes through the service-key admin client. Callers MUST
 * authorize the write to this page first.
 */
export async function syncSharedDraftMeta({
  id,
  locale,
  meta,
}: {
  id: string;
  /** The locale just saved; its draft is left alone. */
  locale: PageEditorLocale;
  meta: Partial<PageMeta>;
}): Promise<void> {
  const { db } = await createAdminClient();
  for (const translation of await listPageTranslations(db, id)) {
    if (translation.locale !== locale) {
      await syncDraftMeta(db, translation, meta);
    }
  }
}

/** `json` with the shared `meta` merged in, or null when nothing changes. */
function withSharedMeta(
  json: string | null | undefined,
  meta: Partial<PageMeta>
): string | null {
  const draft = jsonToPageDoc(json);
  if (!(draft?.meta && typeof draft.meta === "object")) {
    return null;
  }
  const next = pageDocToJson(
    normalizeDocForSave({ ...draft, meta: { ...draft.meta, ...meta } })
  );
  return next === pageDocToJson(draft) ? null : next;
}

/** One write and one retry: see {@link syncSharedDraftMeta}. */
const SHARED_META_ATTEMPTS = 2;

async function syncDraftMeta(
  db: PageDatabase,
  listed: PageTranslations,
  meta: Partial<PageMeta>
): Promise<void> {
  let read = listed;
  for (let attempt = 0; attempt < SHARED_META_ATTEMPTS; attempt += 1) {
    const next = withSharedMeta(read.draft_doc, meta);
    if (next === null) {
      return;
    }
    const fresh = await db.getRow<PageTranslations>(
      "app",
      "page_translations",
      read.$id
    );
    if (fresh.$updatedAt === read.$updatedAt) {
      await db.updateRow("app", "page_translations", read.$id, {
        draft_doc: next,
      });
      return;
    }
    // Written meanwhile: merge into that newer draft instead.
    read = fresh;
  }
  console.warn(
    `[syncSharedDraftMeta] ${listed.$id} kept changing; its shared meta was not updated`
  );
}

/** The document JSON without `meta.theme`, or null when it has none. */
function withoutTheme(json: string | null | undefined): string | null {
  const doc = jsonToPageDoc(json);
  if (!(doc?.meta && typeof doc.meta === "object" && "theme" in doc.meta)) {
    return null;
  }
  const { theme: _copied, ...meta } = doc.meta;
  return pageDocToJson({ ...doc, meta });
}

/**
 * Remove `meta.theme` from every stored document of a page: each locale's
 * draft and published document. Called once a department page's theme has
 * been copied to its department, so the page follows the department again and
 * a later publish of it cannot copy the old theme back. A JSON round trip of
 * the meta only; a document without a theme is not rewritten, and row
 * permissions are left as they are.
 *
 * PRIVILEGED: writes through the service-key admin client. Callers MUST
 * authorize the publish first.
 */
export async function clearPageTheme(id: string): Promise<void> {
  const { db } = await createAdminClient();
  for (const translation of await listPageTranslations(db, id)) {
    const update: Partial<
      Pick<PageTranslations, "draft_doc" | "published_doc">
    > = {};
    const draft = withoutTheme(translation.draft_doc);
    if (draft !== null) {
      update.draft_doc = draft;
    }
    const published = withoutTheme(translation.published_doc);
    if (published !== null) {
      update.published_doc = published;
    }
    if (Object.keys(update).length > 0) {
      await db.updateRow("app", "page_translations", translation.$id, update);
    }
  }
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
      published_doc: translation.draft_doc,
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
 * Unpublish a page's translation (removes it from the public site). The
 * page row becomes a draft only when no other locale is still published.
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

  // The page is one row shared by its locales: it stays published (with its
  // published permissions) while any other locale is still live.
  const stillLive = (await listPageTranslations(db, id)).some(
    (other) => other.$id !== translation?.$id && other.is_published
  );
  if (stillLive) {
    return;
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

/**
 * Archive a page: the row becomes `archived` and, like its translations, drops
 * every permission so only the service key can read it. Translation data is
 * left as it is.
 */
export async function archivePage(
  db: PageDatabase,
  pageId: string
): Promise<void> {
  await db.updateRow(
    "app",
    "pages",
    pageId,
    { status: PagesStatus.ARCHIVED },
    []
  );

  let cursor: string | undefined;
  for (;;) {
    const res = await db.listRows<PageTranslations>(
      "app",
      "page_translations",
      [
        Query.equal("page_id", pageId),
        Query.limit(TRANSLATION_ROWS_LIMIT),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ]
    );
    for (const translation of res.rows) {
      await db.updateRow("app", "page_translations", translation.$id, {}, []);
    }
    const last = res.rows.at(-1);
    if (!last || res.rows.length < TRANSLATION_ROWS_LIMIT) {
      return;
    }
    cursor = last.$id;
  }
}
