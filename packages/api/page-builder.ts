import { ID, Permission, Query, Role } from "./index";
import { createAdminClient, createSessionClient } from "./server";
import type {
  Campus,
  Departments,
  Pages,
  PageTranslations,
  PageTranslationsLocale,
} from "./types/appwrite";
import { PagesStatus, PagesVisibility } from "./types/appwrite";

const OPERATIONS_UNIT_TEAM = "sg-app-dept-operationsunit";
const MEMBERS_TEAM = "biso-members";

interface PageRowTeams {
  campusTeam: string | null;
  deptTeam: string | null;
}

/**
 * Load campus/department display-name lookups so we can derive the owning
 * Appwrite team IDs for a page. Mirrors the admin app's
 * `loadRecruitmentLookups` / `deriveContentRowTeams`, kept self-contained here
 * to avoid a cross-package import.
 */
async function loadPageRowTeams(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  page: { campus_id?: string | null; department_id?: string | null }
): Promise<PageRowTeams> {
  const [campuses, departments] = await Promise.all([
    db.listRows<Campus>("app", "campus", [Query.limit(100)]),
    db.listRows<Departments>("app", "departments", [Query.limit(500)]),
  ]);

  const campusName = page.campus_id
    ? campuses.rows.find((c) => c.$id === page.campus_id)?.name
    : null;
  const campusTeam = campusName
    ? `sg-app-campus-${campusName.toLowerCase().replace(/\s+/g, "")}`
    : null;

  const deptName = page.department_id
    ? departments.rows.find((d) => d.$id === page.department_id)?.Name
    : null;
  const deptTeam = deptName
    ? `sg-app-dept-${deptName.toLowerCase().replace(/\s+/g, "")}`
    : null;

  return { campusTeam, deptTeam };
}

/**
 * Build Appwrite $permissions for a page or page_translations row.
 *
 * Published + public pages get `read(any)`; everything else (draft/archived,
 * or authenticated-only visibility) is restricted to team-scoped reads, so an
 * unpublished page is never publicly readable. Write (update/delete) always
 * goes to Operations Unit plus the owning department team — never the campus
 * team.
 */
function buildPageRowPermissions(opts: {
  isPublished: boolean;
  audience: "public" | "members";
  campusTeam: string | null;
  deptTeam: string | null;
}): string[] {
  const { isPublished, audience, campusTeam, deptTeam } = opts;

  const writeTeams = [
    ...new Set([OPERATIONS_UNIT_TEAM, ...(deptTeam ? [deptTeam] : [])]),
  ];

  const readPerms =
    isPublished && audience === "public"
      ? [Permission.read(Role.any())]
      : [
          Permission.read(Role.team(OPERATIONS_UNIT_TEAM)),
          ...(campusTeam ? [Permission.read(Role.team(campusTeam))] : []),
          ...(deptTeam ? [Permission.read(Role.team(deptTeam))] : []),
          ...(isPublished && audience === "members"
            ? [Permission.read(Role.team(MEMBERS_TEAM))]
            : []),
        ];

  return [
    ...new Set([
      ...readPerms,
      ...writeTeams.flatMap((t) => [
        Permission.update(Role.team(t)),
        Permission.delete(Role.team(t)),
      ]),
    ]),
  ];
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
    Query.select(["$id", "slug", "translation_refs.*"]),
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
  // PRIVILEGED: callers must authorize the requested scope before invoking
  // this helper; the write goes through the service-key admin client.
  const { db } = await createAdminClient();
  const campusId = resolvePageCampusId(ctx);
  let normalizedDoc = normalizeDocForSave(doc);

  if (!id) {
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
  const teams = await loadPageRowTeams(db, {
    campus_id: campusId,
    department_id: departmentId,
  });
  const pagePermissions = buildPageRowPermissions({
    isPublished: pageStatus === PagesStatus.PUBLISHED,
    audience: pageAudience(visibility),
    campusTeam: teams.campusTeam,
    deptTeam: teams.deptTeam,
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
    campusTeam: teams.campusTeam,
    deptTeam: teams.deptTeam,
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
  const teams = await loadPageRowTeams(db, page);
  const permissions = buildPageRowPermissions({
    isPublished:
      page.status === PagesStatus.PUBLISHED &&
      (existing?.is_published ?? false),
    audience: pageAudience(page.visibility),
    campusTeam: teams.campusTeam,
    deptTeam: teams.deptTeam,
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
  const teams = await loadPageRowTeams(db, {
    campus_id: pageRow?.campus_id ?? null,
    department_id: pageRow?.department_id ?? null,
  });
  const publishedPermissions = buildPageRowPermissions({
    isPublished: true,
    audience: pageAudience(visibility),
    campusTeam: teams.campusTeam,
    deptTeam: teams.deptTeam,
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
  const teams = await loadPageRowTeams(db, {
    campus_id: pageRow?.campus_id ?? null,
    department_id: pageRow?.department_id ?? null,
  });
  const draftPermissions = buildPageRowPermissions({
    isPublished: false,
    audience: pageAudience(visibility),
    campusTeam: teams.campusTeam,
    deptTeam: teams.deptTeam,
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
