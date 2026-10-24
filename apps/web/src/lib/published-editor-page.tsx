import type { Departments } from "@repo/api/types/appwrite";
import { sanitizePageDocHtml } from "@repo/editor/sanitize";
import { normalizePageDoc, pruneEmptyFeedBlocks } from "@repo/editor/serialize";
import type { PageDoc } from "@repo/editor/types";
import type { Locale } from "@repo/i18n/config";
import { type ReactNode, Suspense } from "react";
import { RenderedPage } from "@/app/(public)/[...slug]/_components/rendered-page";
import { PageThemeStyle } from "@/components/page-theme-style";
import { resolvePageFeeds } from "@/lib/data/page-feeds";
import {
  cachedDepartmentTheme,
  type cachedPublishedPage,
} from "@/lib/data/public-content";
import { resolvePageTheme } from "@/lib/page-theme";

/** A published lookup (`cachedPublishedPage` answers null for anything else). */
export type PublishedPageResult = NonNullable<
  Awaited<ReturnType<typeof cachedPublishedPage>>
>;

export type DepartmentThemeColumns = Pick<
  Departments,
  "theme_accent" | "theme_dark"
>;

/**
 * "This lookup is a published page with a document" — the one guard the
 * catch-all and `/projects/<slug>` share for the body and for metadata.
 */
export type RenderablePage = PublishedPageResult & {
  translation: NonNullable<PublishedPageResult["translation"]>;
};

export function isRenderablePage(
  result: Awaited<ReturnType<typeof cachedPublishedPage>> | null | undefined
): result is RenderablePage {
  return Boolean(result?.translation?.is_published && result.doc);
}

/**
 * The theme columns of the department a page row is bound to; null for an
 * unbound page, a missing department row, or a failed read (BISO colours,
 * never the page's stale doc theme).
 */
export async function boundDepartmentTheme(
  result: PublishedPageResult
): Promise<DepartmentThemeColumns | null> {
  const departmentId = result.row?.department_id;
  return departmentId
    ? await cachedDepartmentTheme(departmentId).catch(() => null)
    : null;
}

async function PublishedEditorBody({
  doc,
  locale,
  slug,
}: {
  doc: PageDoc;
  locale: Locale;
  slug: string;
}) {
  // Resolve the page's auto-source feeds before rendering, so the HTML carries
  // real events/news/jobs rather than the blocks' "Loading…" placeholder.
  // Every reader behind this is `"use cache"`. See `@/lib/data/page-feeds`.
  const feeds = await resolvePageFeeds(doc, locale);
  // Blocks whose feed came back empty leave no empty band: drop them (and the
  // sections they leave bare) before the renderer picks the nav-clearing first
  // section.
  return (
    <RenderedPage
      doc={pruneEmptyFeedBlocks(doc, feeds, locale)}
      feeds={feeds}
      locale={locale}
      slug={slug}
    />
  );
}

/**
 * The server pipeline every published editor page goes through: normalize,
 * sanitize, feeds, prune, theme. The caller has already decided the page
 * exists (its own lookup, ownership and `notFound()` live in the route).
 *
 * The theme comes first and outside any Suspense boundary so it ships in the
 * first flush with the nav. A page bound to a department (`row.department_id`)
 * wears `departmentTheme`; an unbound one wears its document's own theme (C1).
 *
 * Without `stream` the feeds are awaited here. With it, the body streams in
 * inside the caller's `frame` behind `fallback`: only for a route whose
 * response status is already decided.
 */
export async function renderPublishedEditorPage({
  result,
  locale,
  slug,
  departmentTheme,
  stream,
}: {
  result: PublishedPageResult;
  locale: Locale;
  slug: string;
  departmentTheme: DepartmentThemeColumns | null;
  stream?: { fallback: ReactNode; frame?: (body: ReactNode) => ReactNode };
}): Promise<ReactNode> {
  // Normalized before anything walks it: an old flat (v1) document or a
  // malformed section would otherwise throw in the feed resolver and 500 the
  // page (old documents render empty, D2). Then its text-block HTML is
  // sanitized: stored rows hold whatever markup they were given.
  const doc = sanitizePageDocHtml(normalizePageDoc(result.doc as PageDoc));

  const theme = resolvePageTheme({
    departmentId: result.row?.department_id,
    departmentTheme,
    docTheme: doc.meta?.theme,
  });

  if (stream) {
    const body = (
      <Suspense fallback={stream.fallback}>
        <PublishedEditorBody doc={doc} locale={locale} slug={slug} />
      </Suspense>
    );
    return (
      <>
        <PageThemeStyle theme={theme} />
        {stream.frame ? stream.frame(body) : body}
      </>
    );
  }

  return (
    <>
      <PageThemeStyle theme={theme} />
      {await PublishedEditorBody({ doc, locale, slug })}
    </>
  );
}
