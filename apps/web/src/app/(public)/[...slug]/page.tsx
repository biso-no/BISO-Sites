import { getPage } from "@repo/api/page-builder";
import type { PageDoc } from "@repo/editor";
import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getLocale } from "@/app/actions/locale";
import { SESSION_COOKIE } from "@/lib/cookie-prefs";
import { resolvePageFeeds } from "@/lib/data/page-feeds";
import { cachedPublishedPage } from "@/lib/data/public-content";
import { RenderedPage } from "./_components/rendered-page";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

/**
 * Opt out of the instant shell. `cacheComponents` otherwise warns that `params`
 * is read outside a `<Suspense>` boundary, but the streaming fix is wrong here:
 * once the shell is flushed the response is already committed as 200, so
 * `notFound()` for an unknown slug can no longer produce a 404. A public
 * content route must answer crawlers with a real status, so it blocks on
 * `params` instead. See nextjs.org/docs/messages/instant-shell-url-data.
 */
export const instant = false;

/**
 * Request-memoized page resolution — generateMetadata and the page body both
 * call this, but it runs once per request. The publicly-cached lookup serves
 * every anonymous visitor from cache; pages it cannot see (members-only row
 * permissions) fall back to the visitor's own session, and only when a
 * session cookie actually exists.
 */
const resolvePage = cache(async (slug: string, locale: Locale) => {
  const publicPage = await cachedPublishedPage(slug, locale).catch(() => null);
  if (publicPage) {
    return publicPage;
  }

  if (!(await cookies()).get(SESSION_COOKIE)) {
    return null;
  }
  try {
    return await getPage(slug, locale);
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: segments } = await params;
  if (!segments || segments.length === 0) {
    return {};
  }
  const slug = segments.join("/");
  const locale = await getLocale();
  const result = await resolvePage(slug, locale);
  const title = result?.translation?.title;
  const description = result?.translation?.description ?? undefined;
  if (!title) {
    return {};
  }
  return {
    title: `${title} | BISO`,
    description: description?.slice(0, 160),
  };
}

export default async function DynamicPage({ params }: Props) {
  const { slug: segments } = await params;

  // Root path is handled by (public)/page.tsx; catch-all only fires for non-root
  if (!segments || segments.length === 0) {
    notFound();
  }

  const slug = segments.join("/");
  const locale = await getLocale();
  const result = await resolvePage(slug, locale);

  if (!(result?.translation?.is_published && result.doc)) {
    notFound();
  }

  const doc = result.doc as PageDoc;

  // Resolve the page's auto-source feeds before rendering, so the HTML this
  // route emits carries real events/news/jobs rather than the blocks'
  // "Loading…" placeholder. Awaited deliberately: the blocks read it during
  // their first (server) paint, so streaming it in later would defeat the
  // point. Every reader behind this is `"use cache"`, so it costs no extra
  // Appwrite round-trip per visitor. See `@/lib/data/page-feeds`.
  const feeds = await resolvePageFeeds(doc, locale);

  return <RenderedPage doc={doc} feeds={feeds} locale={locale} />;
}
