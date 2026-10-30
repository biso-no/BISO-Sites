"use server";

import { Query } from "@repo/api";
import { orNullIfRowNotFound } from "@repo/api/errors";
import {
  archivePage,
  PAGE_LOCALES,
  type PageDoc,
  type PageEditorLoadResult,
  type PageEditorLocale,
  clearPageTheme as pbClearPageTheme,
  getPageById as pbGetPageById,
  getPageEditorById as pbGetPageEditorById,
  publishPage as pbPublishPage,
  savePageTranslationDraft as pbSavePageTranslationDraft,
  unpublishPage as pbUnpublishPage,
  resolvePageCampusId,
  savePageDraft,
  syncSharedDraftMeta,
} from "@repo/api/page-builder";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  Departments,
  Pages,
  PageViewEvents,
} from "@repo/api/types/appwrite";
import { sanitizePageDocHtml } from "@repo/editor/sanitize";
import { normalizePageDoc } from "@repo/editor/serialize";
import type { PageDoc as EditorPageDoc } from "@repo/editor/types";
import type { PageTheme } from "@repo/shared/utils/page-theme";
import {
  parseUnitSubPageSlug,
  unitPageSlug,
} from "@repo/shared/utils/unit-urls";
import { revalidatePath } from "next/cache";
import { requireAuth, type UserAuthContext } from "@/lib/authorization";
import {
  applyContentRelationshipScopeQueries,
  assertContentOwnership,
  getContentOwnership,
} from "@/lib/content-authorization";
import {
  type AutoTranslationOptions,
  getTargetLocale,
  isCurrentTranslationSource,
} from "@/lib/content-translation";
import {
  contentLocaleSchema,
  parseAutoTranslationOptions,
  scheduleContentTranslation,
} from "@/lib/content-translation.server";
import { pageAccessContext } from "@/lib/page-access";
import {
  requestedPageCampusId,
  resolvePageSaveCampusId,
} from "@/lib/page-campus";
import {
  getPageTranslationSource,
  translatePageDocument,
} from "@/lib/page-document-translation";
import { withDraftTitles } from "@/lib/page-draft-titles";
import { pickSharedMeta } from "@/lib/page-shared-meta";
import {
  departmentThemeUpdate,
  isDepartmentTheme,
  themeSaveError,
} from "@/lib/page-theme-publish";
import { hasNavAccess } from "@/lib/roles";
import {
  assertDepartmentUserAddress,
  assertProjectPageSave,
  assertUnitPageBindingUnchanged,
  assertUnitPageNamespace,
  isAdminOwnedPageSlug,
  isProjectHubPage,
  requireProjectHubAccess,
} from "@/lib/unit-page-guard";
import {
  applyScopeQueries,
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { notifyWebsite } from "@/lib/web-revalidate";
import { logAuditEvent } from "./audit-log";
import { countDrafts } from "./drafts";

export async function listPages(opts?: { status?: string; campusId?: string }) {
  const ctx = await requireAuth();
  // Private admin read: the service client bypasses row security, so the
  // relationship scope filters below are the authorization boundary.
  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.select(["*", "translation_refs.*"]),
    Query.orderDesc("$updatedAt"),
    Query.limit(100),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  // Single source of truth for campus/department scoping: campus admins see
  // their managed campuses, department users see their department(s), and
  // global admins see everything (or their active-campus filter if set).
  queries.push(...applyContentRelationshipScopeQueries(ctx));

  const response = await db.listRows<Pages>("app", "pages", queries);
  // Titles edited since the last publish live on the draft rows.
  return await withDraftTitles(db, response.rows);
}

export async function getDashboardStats() {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const scopeFilter = applyScopeQueries(ctx);
  // Vacancy counts are for recruiters only.
  const canSeeJobs = hasNavAccess(
    "portal.jobs",
    ctx.roles,
    ctx.departmentTeamIds.length > 0
  );
  const skipped = Promise.resolve({ total: 0 });

  const [jobsRes, eventsRes, newsRes, draftsRes] = await Promise.allSettled([
    canSeeJobs
      ? db.listRows("app", "jobs", [
          Query.equal("status", "published"),
          Query.limit(1),
          ...scopeFilter,
        ])
      : skipped,
    db.listRows("app", "events", [
      Query.equal("status", "published"),
      Query.limit(1),
      ...scopeFilter,
    ]),
    db.listRows("app", "news", [
      Query.equal("status", "published"),
      Query.limit(1),
      ...scopeFilter,
    ]),
    // Same scope as the /drafts queue: vacancies for recruiters, plus events
    // and news for everyone.
    countDrafts().then((total) => ({ total })),
  ]);

  return {
    jobs: jobsRes.status === "fulfilled" ? (jobsRes.value.total ?? 0) : 0,
    events: eventsRes.status === "fulfilled" ? (eventsRes.value.total ?? 0) : 0,
    news: newsRes.status === "fulfilled" ? (newsRes.value.total ?? 0) : 0,
    drafts: draftsRes.status === "fulfilled" ? (draftsRes.value.total ?? 0) : 0,
  };
}

export interface PageViewDay {
  date: string;
  views: number;
}

async function _getPageViewStats(days = 14): Promise<PageViewDay[]> {
  await requireAuth();

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  try {
    const { db } = await createAdminClient();
    const response = await db.listRows<PageViewEvents>(
      "app",
      "page_view_events",
      [
        Query.greaterThanEqual("$createdAt", since.toISOString()),
        Query.orderAsc("$createdAt"),
        Query.limit(5000),
      ]
    );

    // Bucket by day
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets[
        d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      ] = 0;
    }

    for (const row of response.rows) {
      const label = new Date(row.$createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (label in buckets) {
        buckets[label]++;
      }
    }

    return Object.entries(buckets).map(([date, views]) => ({ date, views }));
  } catch (error) {
    console.error("Failed to load page-view stats:", error);
    return [];
  }
}

export async function getPageById(id: string, locale: "no" | "en" = "no") {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const result = await pbGetPageById(id, locale, db);
  if (!result) {
    return null;
  }
  // Treat a row outside the caller's campus/department scope as not found.
  const ownership = getContentOwnership(result.row, { legacyFallback: true });
  if (!hasRowAccess(ctx, ownership.campus, ownership.department)) {
    return null;
  }
  return result;
}

/**
 * Every locale's stored documents with their text-block HTML sanitized. The
 * editor renders that HTML as markup inside the admin session, and rows saved
 * before the save path sanitized, or written straight to the table, hold
 * whatever they were given.
 */
function sanitizeEditorDocuments(
  result: PageEditorLoadResult
): PageEditorLoadResult {
  const translations: PageEditorLoadResult["translations"] = {};
  for (const locale of PAGE_LOCALES) {
    const entry = result.translations[locale];
    if (entry) {
      translations[locale] = {
        ...entry,
        draftDocument:
          entry.draftDocument && sanitizePageDocHtml(entry.draftDocument),
        publishedDocument:
          entry.publishedDocument &&
          sanitizePageDocHtml(entry.publishedDocument),
      };
    }
  }
  return { ...result, translations };
}

export async function getPageEditorById(id: string) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const result = await pbGetPageEditorById(id, db);
  if (!result) {
    return null;
  }
  const departmentId = result.page.departmentId || null;
  // Opening a page is the first step of writing it, so it follows the page
  // write rule: a member of the page's department also reaches it on that
  // department's campus (see pageAccessContext).
  const pageCtx = await pageAccessContext(
    db,
    ctx,
    result.page.campusId,
    departmentId
  );
  if (!hasRowAccess(pageCtx, result.page.campusId, departmentId)) {
    return null;
  }
  return sanitizeEditorDocuments(result);
}

export async function getPageEditorLocales(): Promise<PageEditorLocale[]> {
  await requireAuth();
  return [...PAGE_LOCALES];
}

/**
 * Department users are scoped to pages whose department_id matches one of their
 * departments (see applyScopeQueries). Default a saved page's department to the
 * saver's department when they belong to exactly one and haven't picked one, so
 * a department user never creates a page they immediately can't see again.
 * Admins (global/campus) are left untouched — they routinely manage pages that
 * belong to other departments or none.
 */
function ensureDepartmentForScoping(
  doc: PageDoc,
  ctx: UserAuthContext
): PageDoc {
  const isAdmin =
    ctx.roles.includes("globaladmin") || ctx.managedCampusIds.length > 0;
  if (isAdmin || doc.meta.department) {
    return doc;
  }
  if (ctx.resolvedDepartmentIds.length !== 1) {
    return doc;
  }
  return {
    ...doc,
    meta: { ...doc.meta, department: ctx.resolvedDepartmentIds[0] },
  };
}

/**
 * `doc` without its theme when that theme is what the page's department
 * already has (`isDepartmentTheme`): a second tab opened before a publish
 * moved the theme to the department would otherwise put it back on the page.
 * One read of the department, through the admin client the save already
 * uses; a failed read keeps the theme, as before.
 */
async function withoutDepartmentTheme(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  doc: PageDoc
): Promise<{ dropped: boolean; doc: PageDoc }> {
  const departmentId = doc.meta.department;
  if (!departmentId || doc.meta.theme === undefined) {
    return { doc, dropped: false };
  }
  let department: Departments;
  try {
    department = await db.getRow<Departments>(
      "app",
      "departments",
      departmentId,
      [Query.select(["theme_dark", "theme_accent"])]
    );
  } catch (e) {
    console.error("[savePageEditorDoc] department theme read failed", e);
    return { doc, dropped: false };
  }
  if (!isDepartmentTheme(doc.meta.theme, department)) {
    return { doc, dropped: false };
  }
  const { theme: _departmentHasIt, ...meta } = doc.meta;
  return { doc: { ...doc, meta }, dropped: true };
}

const themeDroppedFlag = (dropped: boolean): { themeDropped?: true } =>
  dropped ? { themeDropped: true } : {};

/** Neither a global admin nor a campus admin: scoped to their departments. */
function isDepartmentUser(ctx: UserAuthContext): boolean {
  return (
    !ctx.roles.includes("globaladmin") && ctx.managedCampusIds.length === 0
  );
}

/**
 * Where a saved page may live: the reserved `units/` and `projects/` address
 * spaces, checked on every save (a create-only check is stepped around by
 * saving an ordinary slug first and renaming afterwards), and, for a
 * department user, their department's unit. An error message, or null.
 */
function pageAddressError({
  ctx,
  departmentId,
  existing,
  nextSlug,
  unitSlug,
}: {
  ctx: UserAuthContext;
  departmentId: string | null;
  existing: Pages | null;
  nextSlug: string;
  unitSlug: string | null;
}): string | null {
  const persistedSlug = existing?.slug ?? null;
  const namespaceError =
    assertUnitPageNamespace(persistedSlug, nextSlug, unitSlug) ??
    assertProjectPageSave({
      isGlobalAdmin: ctx.roles.includes("globaladmin"),
      nextSlug,
      persisted: existing,
    });
  if (namespaceError || !isDepartmentUser(ctx)) {
    return namespaceError;
  }
  if (!departmentId) {
    return "Choose the department this page belongs to.";
  }
  return assertDepartmentUserAddress({ nextSlug, persistedSlug, unitSlug });
}

/**
 * The page's department unit, read from the department row: its unit page
 * address (`units/<campus>/<slug>`; null without a department, a row or a
 * slug), and, when `slug` is a sub-page of it, the department's campus, which
 * the sub-page's URL encodes (undefined otherwise). A missing row is left to
 * the ownership check, which refuses the save.
 */
async function readDepartmentUnit(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  departmentId: string | null,
  slug: string
): Promise<{ subPageCampusId?: string | null; unitSlug: string | null }> {
  const row = departmentId
    ? await orNullIfRowNotFound(
        db.getRow<Departments>("app", "departments", departmentId, [
          Query.select(["$id", "slug", "campus_id"]),
        ])
      )
    : null;
  const unitSlug = row
    ? unitPageSlug({ campusId: row.campus_id, slug: row.slug })
    : null;
  if (!unitSlug || parseUnitSubPageSlug(slug)?.unitSlug !== unitSlug) {
    return { unitSlug };
  }
  return { subPageCampusId: row?.campus_id ?? null, unitSlug };
}

export async function savePageEditorDoc({
  id,
  doc,
  locale = "no",
}: {
  id: string | null;
  doc: PageDoc;
  locale?: PageEditorLocale;
}): Promise<
  | {
      /** The department the page is stored under; "" for none. */
      department: string;
      pageId: string;
      slug: string;
      /** The theme was left out: the page's department already has it. */
      themeDropped?: true;
    }
  | { error: string }
> {
  const ctx = await requireAuth();
  try {
    // Before anything normalizes the document: normalizing silently drops a
    // failing theme, and the editor should hear about it instead.
    const themeError = themeSaveError(doc.meta);
    if (themeError) {
      return { error: themeError };
    }
    const scopedDoc = ensureDepartmentForScoping(doc, ctx);
    // Normalize the incoming slug ONCE, before any guard inspects it, and
    // reuse that exact value everywhere — the guards and the persisted row.
    // resolveUniquePageSlug (packages/api/page-builder.ts) trims the slug
    // before writing it, but assertUnitPageNamespace/isUnitPageSlug used to
    // see the raw, untrimmed value. A padded slug like
    // " units/oslo/fadderullan" therefore slipped past the reserved-namespace
    // guard here and then landed at the exact canonical unit slug once
    // persisted — passing the guard but stealing the department's address.
    // Trimming here, once, keeps the checked value and the stored value
    // byte-identical.
    const normalizedDoc: PageDoc = {
      ...scopedDoc,
      meta: { ...scopedDoc.meta, slug: scopedDoc.meta.slug.trim() },
    };
    // savePageDraft persists through the admin client, so authorization must
    // happen here: the persisted scope for updates, and the requested scope
    // (author-derived campus + submitted department) for every save. Pages
    // already support national scope, so a global admin may keep a null
    // campus.
    const { db } = await createAdminClient();
    const existing = id ? await db.getRow<Pages>("app", "pages", id) : null;
    const persisted = existing
      ? getContentOwnership(existing, { legacyFallback: true })
      : null;
    if (existing) {
      // Authorization FIRST: the slug guards' messages reveal that a page id
      // exists and is (or is not) a unit page, so running them before the
      // access check would turn this action into an existence oracle for any
      // authenticated portal user posting a crafted id.
      assertWriteAccess(
        await pageAccessContext(
          db,
          ctx,
          persisted?.campus,
          persisted?.department
        ),
        persisted?.campus ?? null,
        persisted?.department ?? null
      );
    }
    const departmentId = normalizedDoc.meta.department || null;
    // The unit address of the department the page is saved under, read from
    // the department row: a page may sit at `<unit>/<name>` below it.
    const nextSlug = normalizedDoc.meta.slug;
    const unit = await readDepartmentUnit(db, departmentId, nextSlug);
    const addressError = pageAddressError({
      ctx,
      departmentId,
      existing,
      nextSlug,
      unitSlug: unit.unitSlug,
    });
    if (addressError) {
      return { error: addressError };
    }
    if (existing) {
      // Complementary to the namespace rule above, which cannot see a unit
      // page being renamed OUT of the namespace or re-pointed at another
      // department.
      const bindingError = assertUnitPageBindingUnchanged(existing, {
        department: normalizedDoc.meta.department || "",
        slug: normalizedDoc.meta.slug,
      });
      if (bindingError) {
        return { error: bindingError };
      }
    }
    // An existing page's campus is its own, not the current editor's — see
    // resolvePageSaveCampusId. Re-deriving it from the author on every save
    // (the old behavior) is what made a global admin's autosave of a
    // department page throw here (their campus context is null when no
    // campus is picked in the switcher) and, latently, what let ANY save
    // silently move or null out an existing page's already-correct campus.
    // Compute the value ONCE so authorization and persistence can't disagree.
    // The campus chosen in the editor wins when the document carries one,
    // within what this editor may choose (`requestedPageCampusId`); unit
    // pages keep their campus because their URL encodes it.
    const chosenCampusId =
      "campus" in normalizedDoc.meta
        ? requestedPageCampusId(normalizedDoc.meta.campus, ctx)
        : undefined;
    const campusId = resolvePageSaveCampusId({
      authorCampusId: resolvePageCampusId(ctx),
      campusLocked: isAdminOwnedPageSlug(existing?.slug),
      hub: isProjectHubPage(existing),
      chosenCampusId,
      isUpdate: Boolean(existing),
      persistedCampusId: persisted?.campus ?? null,
      unitCampusId: unit.subPageCampusId,
    });
    // The requested department's own campus, for its member: the ownership
    // check still verifies the department belongs to `campusId`.
    await assertContentOwnership(
      db,
      await pageAccessContext(db, ctx, campusId, departmentId),
      { allowGlobalCampus: true, campusId, departmentId }
    );
    // After the ownership check: the department is verified before it is read.
    const { doc: storedDoc, dropped: themeDropped } =
      await withoutDepartmentTheme(db, normalizedDoc);
    const { pageId, slug } = await savePageDraft({
      id,
      // Text blocks store HTML that the site renders as markup. The editor
      // sanitizes on blur, but this action takes any document a client
      // posts, so what is stored is cleaned here.
      doc: sanitizePageDocHtml(storedDoc),
      locale,
      ctx,
      campusId,
    });
    // The theme, slug, department … are the page's, not the locale's: write
    // them into every other stored locale draft too, so publishing any locale
    // ships what the editor showed. (A new page has no other locale yet.)
    await syncSharedDraftMeta({
      id: pageId,
      locale,
      meta: pickSharedMeta({ ...storedDoc.meta, slug }),
    });
    await logAuditEvent(ctx, "page_saved", {
      resourceId: pageId,
      resourceType: "page",
    });
    revalidatePath("/pages");
    // The department is returned like the slug: a department user's page may
    // have been bound to their department above, and the editor's scope line
    // and canvas must show what Publish will do.
    // `themeDropped` tells a stale tab to stop holding the theme the
    // department already has.
    return {
      department: normalizedDoc.meta.department || "",
      pageId,
      slug,
      ...themeDroppedFlag(themeDropped),
    };
  } catch (e) {
    console.error("[savePageEditorDoc]", e);
    return { error: e instanceof Error ? e.message : "Save failed" };
  }
}

/** What publishPageAction did. */
export type PublishPageResult =
  | {
      /**
       * Nothing was published: the language has no stored row yet. A value,
       * not a thrown error, because Next.js hides a server action's error
       * message in production and the editor must tell this case apart.
       */
      missingTranslation: true;
    }
  | {
      /** The department now has this theme (null: BISO's). */
      departmentTheme: { id: string; theme: PageTheme | null } | null;
      missingTranslation: false;
      /** The theme left the page's stored docs: it follows its department. */
      themeCopied: boolean;
      /** Live, but the department's colours were not updated. */
      themeCopyFailed: boolean;
      translationQueued: boolean;
    };

/**
 * publishPage's messages for a language with no translation row, and for one
 * whose row holds neither a draft nor a published document.
 */
const NO_TRANSLATION_TO_PUBLISH = "No translation found to publish";
const NOTHING_TO_PUBLISH_PREFIX = "Nothing to publish";

function isNotPublishable(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === NO_TRANSLATION_TO_PUBLISH ||
      error.message.startsWith(NOTHING_TO_PUBLISH_PREFIX))
  );
}

export async function publishPageAction(
  id: string,
  locale: "no" | "en" = "no",
  autoTranslation: AutoTranslationOptions = {
    enabled: false,
    sourceLocale: locale,
  }
): Promise<PublishPageResult> {
  const ctx = await requireAuth();
  try {
    const publishedLocale = contentLocaleSchema.parse(locale);
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    // Authorization is enforced here by role (assertPublishAccess); the reads
    // and the publish write use the admin client so an authorized campus
    // approver — who is not on the page rows' write ACL — isn't blocked by RLS.
    const { db } = await createAdminClient();
    // Publishing follows the general write scope: department members may
    // publish their own department's pages, campus/global admins their scope.
    const page = await db.getRow<Pages>("app", "pages", id);
    const ownership = getContentOwnership(page, { legacyFallback: true });
    assertPublishAccess(
      await pageAccessContext(db, ctx, ownership.campus, ownership.department),
      ownership.campus,
      ownership.department
    );
    requireProjectHubAccess(page, ctx.roles);

    if (
      translationOptions?.enabled &&
      translationOptions.sourceLocale !== publishedLocale
    ) {
      throw new Error("The translation source must match the published locale");
    }
    const sourceDocument = translationOptions?.enabled
      ? await getPageSourceDocument(id, publishedLocale, db)
      : null;

    try {
      await pbPublishPage({ id, locale: publishedLocale });
    } catch (e) {
      // Thrown before anything was written.
      if (isNotPublishable(e)) {
        return { missingTranslation: true };
      }
      throw e;
    }
    await logAuditEvent(ctx, "page_published", {
      resourceId: id,
      resourceType: "page",
    });
    const themeCopy = await copyThemeToDepartment({
      ctx,
      db,
      departmentId: ownership.department,
      locale: publishedLocale,
      pageId: id,
    });
    revalidatePath("/pages");
    // The page, and the department when its theme was just written, are
    // cached on the website by tag. Best-effort: never fails the publish.
    await notifyWebsite(
      themeCopy.status === "copied" ? ["pages", "departments"] : ["pages"]
    );
    const publishedPageVersion = sourceDocument
      ? (await db.getRow<Pages>("app", "pages", id)).$updatedAt
      : null;
    // Both locales live in `page_translations`, and neither an edit of one
    // nor an unpublish of one while the other stays live writes the parent
    // row, so the version pin above cannot see them. Snapshot both rows too.
    const translationRows = sourceDocument
      ? await readTranslationRows(id, publishedLocale, db)
      : null;
    const translationQueued =
      sourceDocument && publishedPageVersion && translationRows
        ? scheduleContentTranslation({
            enabled: true,
            task: () =>
              translatePublishedPage({
                id,
                publishedPageVersion,
                sourceDocument,
                sourceLocale: publishedLocale,
                translationRows,
              }),
          })
        : false;
    return {
      departmentTheme:
        themeCopy.status === "copied"
          ? { id: themeCopy.departmentId, theme: themeCopy.theme }
          : null,
      missingTranslation: false,
      themeCopied: themeCopy.status === "copied" && themeCopy.pageCleared,
      themeCopyFailed: themeCopy.status === "failed",
      translationQueued,
    };
  } catch (e) {
    console.error("[publishPageAction]", e);
    throw new Error(e instanceof Error ? e.message : "Failed to publish page");
  }
}

type DepartmentThemeCopy =
  | { status: "unchanged" }
  | { status: "failed" }
  | {
      departmentId: string;
      /** False when the strip failed: the page still holds the theme. */
      pageCleared: boolean;
      status: "copied";
      theme: PageTheme | null;
    };

/**
 * After a publish, copy the published page's theme to its department, then
 * strip the theme from the page's stored docs (every locale's draft and
 * published doc). A department page holds a theme only until it is copied:
 * after that it follows its department, so republishing it later cannot put
 * back colours another page has since replaced. Reset (`null`) is copied as
 * nulls and stripped the same way.
 *
 * Never throws into the publish: the page is already live. A failed copy
 * leaves the theme on the page, so the next publish retries it.
 */
async function copyThemeToDepartment({
  ctx,
  db,
  departmentId,
  locale,
  pageId,
}: {
  ctx: UserAuthContext;
  db: Awaited<ReturnType<typeof createAdminClient>>["db"];
  departmentId: string | null;
  locale: PageEditorLocale;
  pageId: string;
}): Promise<DepartmentThemeCopy> {
  if (!departmentId) {
    return { status: "unchanged" };
  }
  let update: Exclude<ReturnType<typeof departmentThemeUpdate>, "skip">;
  try {
    const editor = await pbGetPageEditorById(pageId, db);
    const published = editor?.translations[locale]?.publishedDocument;
    if (!published) {
      return { status: "unchanged" };
    }
    // Normalizing drops a failing theme to absent, so "invalid" is unreachable
    // here; it is handled as a skip anyway.
    const next = departmentThemeUpdate(
      normalizePageDoc(published as EditorPageDoc).meta
    );
    if (next === "skip") {
      return { status: "unchanged" };
    }
    if (next === "invalid") {
      console.warn(
        `[publishPageAction] page ${pageId} carries an invalid theme; department ${departmentId} left unchanged`
      );
      return { status: "unchanged" };
    }
    update = next;
    await db.updateRow("app", "departments", departmentId, update);
  } catch (e) {
    console.error("[publishPageAction] department theme update failed", e);
    return { status: "failed" };
  }
  const theme =
    update.theme_dark && update.theme_accent
      ? { accent: update.theme_accent, dark: update.theme_dark }
      : null;
  try {
    await logAuditEvent(ctx, "department_theme_updated", {
      payload: { pageId, ...update },
      resourceId: departmentId,
      resourceType: "department",
    });
  } catch (e) {
    console.error("[publishPageAction] department theme audit failed", e);
  }
  try {
    await pbClearPageTheme(pageId);
  } catch (e) {
    // The department has the colours; the page keeps them too, so the next
    // publish copies them again and retries the strip.
    console.error("[publishPageAction] page theme strip failed", e);
    return { departmentId, pageCleared: false, status: "copied", theme };
  }
  return { departmentId, pageCleared: true, status: "copied", theme };
}

async function getPageSourceDocument(
  id: string,
  locale: PageEditorLocale,
  db: Awaited<ReturnType<typeof createAdminClient>>["db"]
): Promise<PageDoc | null> {
  const editor = await pbGetPageEditorById(id, db);
  const translation = editor?.translations[locale];
  return translation?.draftDocument ?? translation?.publishedDocument ?? null;
}

/** Whole-document equality on the translatable fields, in both directions. */
function isSamePageDocument(a: PageDoc | null, b: PageDoc | null): boolean {
  if (!(a && b)) {
    return !(a || b);
  }
  return (
    JSON.stringify(getPageTranslationSource(a)) ===
    JSON.stringify(getPageTranslationSource(b))
  );
}

type AdminDatabase = Awaited<ReturnType<typeof createAdminClient>>["db"];

/**
 * One locale's draft and publish state, as the auto-translation guard
 * compares it: the draft row's `updatedAt` moves on every draft save, and
 * `isPublished` and `publishedAt` on every publish and unpublish.
 */
interface TranslationRowState {
  document: PageDoc | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
}

/** The source and target locale's rows. A locale with no row is null. */
interface TranslationRows {
  source: TranslationRowState | null;
  target: TranslationRowState | null;
}

async function readTranslationRows(
  id: string,
  sourceLocale: PageEditorLocale,
  db: AdminDatabase
): Promise<TranslationRows> {
  const editor = await pbGetPageEditorById(id, db);
  const rowState = (locale: PageEditorLocale): TranslationRowState | null => {
    const translation = editor?.translations[locale];
    if (!translation) {
      return null;
    }
    return {
      document:
        translation.draftDocument ?? translation.publishedDocument ?? null,
      isPublished: translation.isPublished,
      publishedAt: translation.publishedAt ?? null,
      updatedAt: translation.updatedAt ?? null,
    };
  };
  return {
    source: rowState(sourceLocale),
    target: rowState(getTargetLocale(sourceLocale)),
  };
}

/** Whether nobody wrote the row in between: no edit, publish or unpublish. */
function isSameTranslationRow(
  before: TranslationRowState | null,
  after: TranslationRowState | null
): boolean {
  if (!(before && after)) {
    return !(before || after);
  }
  return (
    before.isPublished === after.isPublished &&
    before.publishedAt === after.publishedAt &&
    before.updatedAt === after.updatedAt &&
    isSamePageDocument(before.document, after.document)
  );
}

/** The page row and both translation rows, read together. */
async function readPublishState(
  id: string,
  sourceLocale: PageEditorLocale,
  db: AdminDatabase
): Promise<{ page: Pages; rows: TranslationRows }> {
  const [page, rows] = await Promise.all([
    db.getRow<Pages>("app", "pages", id),
    readTranslationRows(id, sourceLocale, db),
  ]);
  return { page, rows };
}

/**
 * Whether the publish that queued the translation still stands: the page row
 * is as that publish left it and the source locale is still live. Unpublishing
 * one locale while the other stays live leaves the page row untouched, so the
 * row alone cannot tell.
 */
function sourcePublishStands(
  state: { page: Pages; rows: TranslationRows },
  publishedPageVersion: string
): boolean {
  return (
    state.page.status === "published" &&
    state.page.$updatedAt === publishedPageVersion &&
    state.rows.source?.isPublished === true
  );
}

/**
 * Translate the locale just published into the other one, save it as that
 * locale's draft and publish it. Gives up, writing nothing more, as soon as
 * the editor has acted on either locale since the publish: unpublished the
 * source, edited it, or edited, published or unpublished the target. The
 * check runs before the draft save and again before the publish.
 */
async function translatePublishedPage({
  id,
  publishedPageVersion,
  sourceDocument,
  sourceLocale,
  translationRows,
}: {
  id: string;
  publishedPageVersion: string;
  sourceDocument: PageDoc;
  sourceLocale: PageEditorLocale;
  /** Both locales' rows as this publish left them. */
  translationRows: TranslationRows;
}): Promise<void> {
  const { db } = await createAdminClient();
  const targetLocale = getTargetLocale(sourceLocale);
  const translatedDocument = await translatePageDocument({
    document: sourceDocument,
    sourceLocale,
    targetLocale,
  });
  const current = await readPublishState(id, sourceLocale, db);
  const currentSource = current.rows.source?.document;
  if (
    !(
      sourcePublishStands(current, publishedPageVersion) &&
      currentSource &&
      isCurrentTranslationSource(
        getPageTranslationSource(sourceDocument),
        getPageTranslationSource(currentSource)
      )
    )
  ) {
    return;
  }
  // An editor who worked on, published or unpublished the destination locale
  // while the model request was in flight owns it.
  if (!isSameTranslationRow(translationRows.target, current.rows.target)) {
    return;
  }

  const saved = await pbSavePageTranslationDraft({
    // Model output: its text-block HTML is as untrusted as a client's. The
    // shared meta comes from the source as stored now, not the snapshot: a
    // theme the publish copied to the department has left the page since.
    doc: sanitizePageDocHtml({
      ...translatedDocument,
      meta: {
        ...translatedDocument.meta,
        ...pickSharedMeta(currentSource.meta),
        status: "published",
      },
    }),
    id,
    locale: targetLocale,
  });
  // Our save is now the target's latest write; anything after it is the
  // editor's.
  const beforePublish = await readPublishState(id, sourceLocale, db);
  const target = beforePublish.rows.target;
  if (
    !(
      sourcePublishStands(beforePublish, publishedPageVersion) &&
      target &&
      target.updatedAt === saved.updatedAt &&
      target.isPublished === (translationRows.target?.isPublished ?? false) &&
      target.publishedAt === (translationRows.target?.publishedAt ?? null)
    )
  ) {
    return;
  }
  await pbPublishPage({
    id,
    locale: targetLocale,
    updateParentStatus: false,
  });
  revalidatePath("/pages");
  await notifyWebsite(["pages"]);
}

/** Take a page off the public site in every locale. */
export async function unpublishPageAction(id: string) {
  const ctx = await requireAuth();
  try {
    // Admin client for the same reason as publishPageAction — authorization is
    // by role below, and the write must not be blocked by RLS for a campus
    // approver who is not on the page rows' write ACL.
    const { db } = await createAdminClient();
    // Unpublishing (removing from the public site) is publish-gated the same
    // way as publishing: general write scope over the page's ownership.
    const page = await db.getRow<Pages>("app", "pages", id);
    const ownership = getContentOwnership(page, { legacyFallback: true });
    assertPublishAccess(
      await pageAccessContext(db, ctx, ownership.campus, ownership.department),
      ownership.campus,
      ownership.department
    );
    requireProjectHubAccess(page, ctx.roles);

    await pbUnpublishPage({ id });
    await logAuditEvent(ctx, "page_unpublished", {
      resourceId: id,
      resourceType: "page",
    });
    revalidatePath("/pages");
    await notifyWebsite(["pages"]);
  } catch (e) {
    console.error("[unpublishPageAction]", e);
    throw new Error(
      e instanceof Error ? e.message : "Failed to unpublish page"
    );
  }
}

export async function deletePageAction(id: string) {
  const ctx = await requireAuth();
  try {
    // Authorization is by role (assertWriteAccess); admin client so an
    // authorized campus admin — not on the page rows' write ACL — can archive.
    const { db } = await createAdminClient();
    // Archiving is a write, not a publish — gate it like deleteEvent/deleteNews
    // so a user can only archive pages within their campus/department scope.
    const page = await db.getRow<Pages>("app", "pages", id);
    const ownership = getContentOwnership(page, { legacyFallback: true });
    assertWriteAccess(
      await pageAccessContext(db, ctx, ownership.campus, ownership.department),
      ownership.campus,
      ownership.department
    );
    requireProjectHubAccess(page, ctx.roles);

    await archivePage(db, id);
    await logAuditEvent(ctx, "page_deleted", {
      resourceId: id,
      resourceType: "page",
    });
    revalidatePath("/pages");
    // Archiving a published page takes it offline too.
    await notifyWebsite(["pages"]);
  } catch (e) {
    console.error("[deletePageAction]", e);
    throw new Error(e instanceof Error ? e.message : "Failed to delete page");
  }
}
