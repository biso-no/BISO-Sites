import { orNullIfRowNotFound } from "./errors";
import { ID, type Models, Permission, Query, Role } from "./index";
import { createAdminClient, createSessionClient } from "./server";
import type {
  Pages,
  PageTranslations,
  PageTranslationsLocale,
} from "./types/appwrite";
import { PagesStatus, PagesVisibility } from "./types/appwrite";

const MEMBERS_TEAM = "biso-members";

/**
 * Unpublished work on a page translation: its draft document, title and
 * description. A published `page_translations` row is readable by anyone, so
 * drafts live in this service-only table (no permissions on the table or its
 * rows) and reach the translation row only when the locale is published. A
 * draft row's `$id` is its translation row's `$id`.
 *
 * Drafts saved before this table existed are still on the translation row
 * (`draft_doc`, `title`, `description`) until they are migrated; every read
 * here falls back to those columns when a translation has no draft row.
 */
export const PAGE_DRAFTS_TABLE_ID = "page_drafts";

/** A `page_drafts` row: see {@link PAGE_DRAFTS_TABLE_ID}. */
export type PageDraftRow = Models.Row & {
  description: string | null;
  draft_doc: string | null;
  locale: PageTranslationsLocale;
  page_id: string;
  title: string | null;
};

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
  /** The draft's description. */
  description?: string;
  draftDocument: PageDoc | null;
  /** The `page_translations` row id, which is also the draft row's id. */
  id?: string;
  isPublished: boolean;
  locale: PageEditorLocale;
  publishedAt: string | null;
  publishedDocument: PageDoc | null;
  /** The draft's title. */
  title: string;
  /**
   * The draft row's `$updatedAt`; the translation row's for a draft that is
   * still on it (see {@link PAGE_DRAFTS_TABLE_ID}).
   */
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

/**
 * `doc` with the meta its rows own: slug, department and status from the
 * page row, title and description from `text` (the draft's for a draft, the
 * translation row's for the published document).
 */
function normalizeDoc({
  doc,
  row,
  text,
}: {
  doc: PageDoc | null;
  row: Pages;
  text: { description?: string | null; title?: string | null };
}): PageDoc | null {
  if (!doc) {
    return null;
  }
  return {
    ...doc,
    meta: {
      ...doc.meta,
      slug: row.slug ?? doc.meta.slug,
      title: text.title ?? doc.meta.title,
      description: text.description ?? doc.meta.description,
      department: row.department_id ?? doc.meta.department,
      status: row.status === "archived" ? "draft" : row.status,
    },
  };
}

/** A translation's draft, wherever it is stored. */
interface StoredDraft {
  description: string | null;
  draftDoc: string | null;
  title: string;
  /** `$updatedAt` of the row the draft was read from. */
  updatedAt: string;
}

/**
 * The draft of `translation`: its draft row when it has one, otherwise the
 * draft still on the translation row from before drafts had their own table.
 */
function storedDraft(
  translation: PageTranslations,
  draft: PageDraftRow | null | undefined
): StoredDraft {
  if (draft) {
    return {
      description: draft.description ?? null,
      draftDoc: draft.draft_doc ?? null,
      title: draft.title ?? translation.title,
      updatedAt: draft.$updatedAt,
    };
  }
  return {
    description: translation.description ?? null,
    draftDoc: translation.draft_doc ?? null,
    title: translation.title,
    updatedAt: translation.$updatedAt,
  };
}

function toEditorTranslation(
  row: Pages,
  translation: PageTranslations,
  draftRow: PageDraftRow | undefined
): PageTranslationEditorEntry | null {
  if (!isPageEditorLocale(translation.locale)) {
    return null;
  }
  const draft = storedDraft(translation, draftRow);
  const draftDocument = normalizeDoc({
    doc: jsonToPageDoc(draft.draftDoc),
    row,
    text: draft,
  });
  const publishedDocument = normalizeDoc({
    doc: jsonToPageDoc(translation.published_doc),
    row,
    text: translation,
  });

  return {
    id: translation.$id,
    locale: translation.locale,
    title: draft.title,
    description: draft.description ?? undefined,
    draftDocument,
    publishedDocument,
    isPublished: translation.is_published,
    publishedAt: translation.published_at,
    updatedAt: draft.updatedAt,
  };
}

function toEditorLoadResult(
  row: Pages,
  drafts: Map<string, PageDraftRow>
): PageEditorLoadResult {
  const translations: PageTranslationMap = {};
  const translationRows = Array.isArray(row.translation_refs)
    ? row.translation_refs
    : [];

  for (const translation of translationRows) {
    const entry = toEditorTranslation(
      row,
      translation,
      drafts.get(translation.$id)
    );
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
      // The published translation fields the public site reads. Never `*`:
      // a translation row can still hold a draft from before drafts moved to
      // their own table (`draft_doc`, and the unused `puck_document` and
      // `draft_document`), and this read serves the public.
      "translation_refs.$id",
      "translation_refs.locale",
      "translation_refs.is_published",
      "translation_refs.published_at",
      "translation_refs.published_doc",
      "translation_refs.title",
      "translation_refs.description",
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
  // `is_published` with no `published_doc`; falling back to their draft
  // would put unpublished edits on the public site.
  const doc = translation
    ? normalizeDoc({
        doc: jsonToPageDoc(translation.published_doc),
        row,
        text: translation,
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

/**
 * The page and every locale's draft and published document, for the editor.
 * The draft table is service-only, so pass the admin client's `db`.
 */
export async function getPageEditorById(
  id: string,
  dbOverride?: PageDatabase
): Promise<PageEditorLoadResult | null> {
  const db = dbOverride ?? (await createSessionClient()).db;

  const [res, drafts] = await Promise.all([
    db.listRows<Pages>("app", "pages", [
      Query.equal("$id", id),
      // `translation_refs.*` includes a draft still on the translation row:
      // the fallback for a locale with no draft row.
      Query.select(["*", "translation_refs.*", "campus.$id", "department.$id"]),
      Query.limit(1),
    ]),
    listPageDrafts(db, id),
  ]);

  const row = res.rows[0];
  if (!row) {
    return null;
  }
  return toEditorLoadResult(row, drafts);
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

/** The translation a draft write went to. */
interface TranslationDraftWrite {
  translationId: string;
  /** The draft row's `$updatedAt` after this write. */
  updatedAt: string;
}

/**
 * Store `doc` as the draft of the page's `locale` translation, in its draft
 * row. An existing translation row is not written, so its publish state,
 * published title and description, and permissions stay as publishing left
 * them; the one exception drops a draft saved on it before drafts had their
 * own table, once the draft row holds the new one. A locale with no row gets
 * one, unpublished and service-only, with the draft's title and description.
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
    description: doc.meta.description ?? null,
    draftDoc: pageDocToJson(doc),
    title: doc.meta.title,
  };
  const row = existing.rows[0];
  let translationId = row?.$id;
  if (!translationId) {
    const created = await db.upsertRow<PageTranslations>(
      "app",
      "page_translations",
      ID.unique(),
      {
        title: draft.title,
        description: draft.description,
        page_id: pageId,
        page: pageId as unknown as Pages,
        locale: locale as PageTranslationsLocale,
        is_published: false,
      },
      buildPageRowPermissions({ isPublished: false, audience: "public" })
    );
    translationId = created.$id;
  }

  const written = await writeDraftRow(
    db,
    { locale, pageId, translationId },
    draft
  );
  if (typeof row?.draft_doc === "string") {
    await db.updateRow("app", "page_translations", row.$id, {
      draft_doc: null,
    });
  }
  return { translationId, updatedAt: written.$updatedAt };
}

/**
 * Save one translated draft without mutating the parent page. Returns the
 * draft row's `$updatedAt` after the write, so a caller that publishes next
 * can tell whether anyone wrote the locale's draft in between.
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

/** A page's draft rows, by translation row id. */
async function listPageDrafts(
  db: PageDatabase,
  pageId: string
): Promise<Map<string, PageDraftRow>> {
  const res = await db.listRows<PageDraftRow>("app", PAGE_DRAFTS_TABLE_ID, [
    Query.equal("page_id", pageId),
    Query.limit(TRANSLATION_ROWS_LIMIT),
  ]);
  return new Map(res.rows.map((draft) => [draft.$id, draft]));
}

/** A translation's draft row, or null when it has none. */
async function getDraftRow(
  db: PageDatabase,
  translationId: string
): Promise<PageDraftRow | null> {
  return await orNullIfRowNotFound(
    db.getRow<PageDraftRow>("app", PAGE_DRAFTS_TABLE_ID, translationId)
  );
}

/** A translation's draft as stored now: see {@link storedDraft}. */
async function readStoredDraft(
  db: PageDatabase,
  translation: PageTranslations
): Promise<StoredDraft> {
  const draft = await getDraftRow(db, translation.$id);
  if (draft) {
    return storedDraft(translation, draft);
  }
  const row = await db.getRow<PageTranslations>(
    "app",
    "page_translations",
    translation.$id
  );
  return storedDraft(row, null);
}

/** The translation a draft row belongs to; the row's id is the translation's. */
interface DraftTarget {
  locale: PageEditorLocale;
  pageId: string;
  translationId: string;
}

/**
 * Write a translation's draft to its draft row, creating the row on the
 * first write. Draft rows carry no permissions: only the service key reads
 * them.
 */
async function writeDraftRow(
  db: PageDatabase,
  { locale, pageId, translationId }: DraftTarget,
  draft: Pick<StoredDraft, "description" | "draftDoc" | "title">
): Promise<PageDraftRow> {
  return await db.upsertRow<PageDraftRow>(
    "app",
    PAGE_DRAFTS_TABLE_ID,
    translationId,
    {
      page_id: pageId,
      locale: locale as PageTranslationsLocale,
      draft_doc: draft.draftDoc,
      title: draft.title,
      description: draft.description,
    },
    []
  );
}

/**
 * Write the meta every locale shares into each OTHER locale's stored draft of
 * a page, so a theme (or slug, department …) saved in one locale is what the
 * other locale's Publish copies live. `meta` holds exactly the shared fields,
 * chosen by the caller; one that is undefined is removed from the drafts, and
 * `null` is kept. Only drafts that exist are touched: no translation row is
 * created, and a draft that already holds these values is not rewritten. The
 * write goes to the locale's draft row; a draft still on the translation row
 * moves into one, and the translation row itself is not written.
 *
 * Each draft is re-read just before it is written: another tab may have
 * saved that locale since the list was read, and writing the listed copy
 * back would undo its edit. When the draft changed, the shared meta is merged
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
  const [translations, drafts] = await Promise.all([
    listPageTranslations(db, id),
    listPageDrafts(db, id),
  ]);
  for (const translation of translations) {
    if (
      translation.locale !== locale &&
      isPageEditorLocale(translation.locale)
    ) {
      await syncDraftMeta(
        db,
        translation,
        {
          locale: translation.locale,
          pageId: id,
          translationId: translation.$id,
        },
        storedDraft(translation, drafts.get(translation.$id)),
        meta
      );
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
  translation: PageTranslations,
  target: DraftTarget,
  listed: StoredDraft,
  meta: Partial<PageMeta>
): Promise<void> {
  let read = listed;
  for (let attempt = 0; attempt < SHARED_META_ATTEMPTS; attempt += 1) {
    const next = withSharedMeta(read.draftDoc, meta);
    if (next === null) {
      return;
    }
    const fresh = await readStoredDraft(db, translation);
    if (fresh.updatedAt === read.updatedAt) {
      await writeDraftRow(db, target, { ...read, draftDoc: next });
      return;
    }
    // Written meanwhile: merge into that newer draft instead.
    read = fresh;
  }
  console.warn(
    `[syncSharedDraftMeta] ${translation.$id} kept changing; its shared meta was not updated`
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
 * draft (written to its draft row) and published document (on the
 * translation row). Called once a department page's theme has been copied to
 * its department, so the page follows the department again and a later
 * publish of it cannot copy the old theme back. A JSON round trip of the meta
 * only; a document without a theme is not rewritten, and translation row
 * permissions are left as they are.
 *
 * PRIVILEGED: writes through the service-key admin client. Callers MUST
 * authorize the publish first.
 */
export async function clearPageTheme(id: string): Promise<void> {
  const { db } = await createAdminClient();
  const [translations, drafts] = await Promise.all([
    listPageTranslations(db, id),
    listPageDrafts(db, id),
  ]);
  for (const translation of translations) {
    const draft = storedDraft(translation, drafts.get(translation.$id));
    const draftDoc = withoutTheme(draft.draftDoc);
    if (draftDoc !== null && isPageEditorLocale(translation.locale)) {
      await writeDraftRow(
        db,
        {
          locale: translation.locale,
          pageId: id,
          translationId: translation.$id,
        },
        { ...draft, draftDoc }
      );
    }
    const published = withoutTheme(translation.published_doc);
    if (published !== null) {
      await db.updateRow("app", "page_translations", translation.$id, {
        published_doc: published,
      });
    }
  }
}

/**
 * Publish a page's translation: its draft's document, title and description
 * become the translation row's published document, title and description.
 * The draft is the locale's draft row, or the draft still on the translation
 * row when it has none (see {@link PAGE_DRAFTS_TABLE_ID}).
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

  const [pageRes, draftRow] = await Promise.all([
    db.listRows<Pages>("app", "pages", [
      Query.equal("$id", id),
      Query.limit(1),
    ]),
    getDraftRow(db, translation.$id),
  ]);
  const pageRow = pageRes.rows[0];
  const visibility = pageRow?.visibility ?? PagesVisibility.PUBLIC;
  const publishedPermissions = buildPageRowPermissions({
    isPublished: true,
    audience: pageAudience(visibility),
  });
  const draft = storedDraft(translation, draftRow);

  await db.updateRow(
    "app",
    "page_translations",
    translation.$id,
    {
      published_doc: draft.draftDoc,
      title: draft.title,
      description: draft.description,
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
    await grantReadToPublishedTranslations(
      db,
      id,
      translation.$id,
      publishedPermissions
    );
  }
}

/**
 * Give every other translation of a page that is marked published the page's
 * published read permissions, so a locale that was published before the page
 * was archived is readable again once the page is live. Data is untouched.
 */
async function grantReadToPublishedTranslations(
  db: PageDatabase,
  pageId: string,
  exceptId: string,
  permissions: string[]
): Promise<void> {
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
    for (const other of res.rows) {
      if (other.$id !== exceptId && other.is_published === true) {
        await db.updateRow(
          "app",
          "page_translations",
          other.$id,
          {},
          permissions
        );
      }
    }
    const last = res.rows.at(-1);
    if (!last || res.rows.length < TRANSLATION_ROWS_LIMIT) {
      return;
    }
    cursor = last.$id;
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
