"use server";

import { Query } from "@repo/api";
import {
  PAGE_LOCALES,
  type PageDoc,
  type PageEditorLocale,
  getPageById as pbGetPageById,
  getPageEditorById as pbGetPageEditorById,
  publishPage as pbPublishPage,
  savePageTranslationDraft as pbSavePageTranslationDraft,
  unpublishPage as pbUnpublishPage,
  resolvePageCampusId,
  savePageDraft,
} from "@repo/api/page-builder";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Pages, PageViewEvents } from "@repo/api/types/appwrite";
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
import { resolvePageSaveCampusId } from "@/lib/page-campus";
import {
  getPageTranslationSource,
  translatePageDocument,
} from "@/lib/page-document-translation";
import {
  assertUnitPageBindingUnchanged,
  assertUnitPageNamespace,
} from "@/lib/unit-page-guard";
import {
  applyScopeQueries,
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";

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
  return response.rows;
}

export async function getDashboardStats() {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const scopeFilter = applyScopeQueries(ctx);

  const [jobsRes, eventsRes, newsRes, draftsRes] = await Promise.allSettled([
    db.listRows("app", "jobs", [
      Query.equal("status", "published"),
      Query.limit(1),
      ...scopeFilter,
    ]),
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
    db.listRows("app", "jobs", [
      Query.equal("status", "draft"),
      Query.limit(1),
      ...scopeFilter,
    ]),
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

export async function getPageEditorById(id: string) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const result = await pbGetPageEditorById(id, db);
  if (!result) {
    return null;
  }
  if (
    !hasRowAccess(ctx, result.page.campusId, result.page.departmentId || null)
  ) {
    return null;
  }
  return result;
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

export async function savePageEditorDoc({
  id,
  doc,
  locale = "no",
}: {
  id: string | null;
  doc: PageDoc;
  locale?: PageEditorLocale;
}): Promise<{ pageId: string; slug: string } | { error: string }> {
  const ctx = await requireAuth();
  try {
    const scopedDoc = ensureDepartmentForScoping(doc, ctx);
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
        ctx,
        persisted?.campus ?? null,
        persisted?.department ?? null
      );
    }
    // Every save, create or update: a create-only check is stepped around by
    // saving an ordinary slug first and renaming into `units/` afterwards.
    const namespaceError = assertUnitPageNamespace(
      existing?.slug ?? null,
      scopedDoc.meta.slug
    );
    if (namespaceError) {
      return { error: namespaceError };
    }
    if (existing) {
      // Complementary to the namespace rule above, which cannot see a unit
      // page being renamed OUT of the namespace or re-pointed at another
      // department.
      const bindingError = assertUnitPageBindingUnchanged(existing, {
        department: scopedDoc.meta.department || "",
        slug: scopedDoc.meta.slug,
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
    const campusId = resolvePageSaveCampusId({
      authorCampusId: resolvePageCampusId(ctx),
      isUpdate: Boolean(existing),
      persistedCampusId: persisted?.campus ?? null,
    });
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: true,
      campusId,
      departmentId: scopedDoc.meta.department || null,
    });
    const { pageId, slug } = await savePageDraft({
      id,
      doc: scopedDoc,
      locale,
      ctx,
      campusId,
    });
    await logAuditEvent(ctx, "page_saved", {
      resourceId: pageId,
      resourceType: "page",
    });
    revalidatePath("/pages");
    return { pageId, slug };
  } catch (e) {
    console.error("[savePageEditorDoc]", e);
    return { error: e instanceof Error ? e.message : "Save failed" };
  }
}

export async function publishPageAction(
  id: string,
  locale: "no" | "en" = "no",
  autoTranslation: AutoTranslationOptions = {
    enabled: false,
    sourceLocale: locale,
  }
) {
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
    assertPublishAccess(ctx, ownership.campus, ownership.department);

    if (
      translationOptions?.enabled &&
      translationOptions.sourceLocale !== publishedLocale
    ) {
      throw new Error("The translation source must match the published locale");
    }
    const sourceDocument = translationOptions?.enabled
      ? await getPageSourceDocument(id, publishedLocale, db)
      : null;

    await pbPublishPage({ id, locale: publishedLocale });
    await logAuditEvent(ctx, "page_published", {
      resourceId: id,
      resourceType: "page",
    });
    revalidatePath("/pages");
    const publishedPageVersion = sourceDocument
      ? (await db.getRow<Pages>("app", "pages", id)).$updatedAt
      : null;
    // Translation drafts live in `page_translations`, which never touches the
    // parent row, so the version pin above cannot see a concurrent edit of the
    // destination locale. Snapshot it too.
    const destinationDocument = sourceDocument
      ? await getPageSourceDocument(id, getTargetLocale(publishedLocale), db)
      : null;
    const translationQueued =
      sourceDocument && publishedPageVersion
        ? scheduleContentTranslation({
            enabled: true,
            task: () =>
              translatePublishedPage({
                destinationDocument,
                id,
                publishedPageVersion,
                sourceDocument,
                sourceLocale: publishedLocale,
              }),
          })
        : false;
    return { translationQueued };
  } catch (e) {
    console.error("[publishPageAction]", e);
    throw new Error(e instanceof Error ? e.message : "Failed to publish page");
  }
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

async function translatePublishedPage({
  destinationDocument,
  id,
  publishedPageVersion,
  sourceDocument,
  sourceLocale,
}: {
  /** The target locale as this publish left it — see the stale check below. */
  destinationDocument: PageDoc | null;
  id: string;
  publishedPageVersion: string;
  sourceDocument: PageDoc;
  sourceLocale: PageEditorLocale;
}): Promise<void> {
  const { db } = await createAdminClient();
  const targetLocale = getTargetLocale(sourceLocale);
  const translatedDocument = await translatePageDocument({
    document: sourceDocument,
    sourceLocale,
    targetLocale,
  });
  const [currentPage, currentSource, currentDestination] = await Promise.all([
    db.getRow<Pages>("app", "pages", id),
    getPageSourceDocument(id, sourceLocale, db),
    getPageSourceDocument(id, targetLocale, db),
  ]);
  if (
    !(
      currentPage.status === "published" &&
      currentPage.$updatedAt === publishedPageVersion &&
      currentSource &&
      isCurrentTranslationSource(
        getPageTranslationSource(sourceDocument),
        getPageTranslationSource(currentSource)
      )
    )
  ) {
    return;
  }
  // An editor who worked on the destination locale while the model request was
  // in flight owns the newer document.
  if (!isSamePageDocument(destinationDocument, currentDestination)) {
    return;
  }

  await pbSavePageTranslationDraft({
    doc: {
      ...translatedDocument,
      meta: { ...translatedDocument.meta, status: "published" },
    },
    id,
    locale: targetLocale,
  });
  const pageBeforeDestinationPublish = await db.getRow<Pages>(
    "app",
    "pages",
    id
  );
  if (
    pageBeforeDestinationPublish.status !== "published" ||
    pageBeforeDestinationPublish.$updatedAt !== publishedPageVersion
  ) {
    return;
  }
  await pbPublishPage({
    id,
    locale: targetLocale,
    updateParentStatus: false,
  });
  revalidatePath("/pages");
}

export async function unpublishPageAction(
  id: string,
  locale: "no" | "en" = "no"
) {
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
    assertPublishAccess(ctx, ownership.campus, ownership.department);

    await pbUnpublishPage({ id, locale });
    await logAuditEvent(ctx, "page_unpublished", {
      resourceId: id,
      resourceType: "page",
    });
    revalidatePath("/pages");
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
    assertWriteAccess(ctx, ownership.campus, ownership.department);

    await db.updateRow("app", "pages", id, { status: "archived" });
    await logAuditEvent(ctx, "page_deleted", {
      resourceId: id,
      resourceType: "page",
    });
    revalidatePath("/pages");
  } catch (e) {
    console.error("[deletePageAction]", e);
    throw new Error(e instanceof Error ? e.message : "Failed to delete page");
  }
}
