import { getPage } from "@repo/api/page-builder";
import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getLocale } from "@/app/actions/locale";
import { SESSION_COOKIE } from "@/lib/cookie-prefs";
import {
  cachedPublishedPage,
  isPublishedPage,
} from "@/lib/data/public-content";
import {
  boundDepartmentTheme,
  isRenderablePage,
  renderPublishedEditorPage,
} from "@/lib/published-editor-page";

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
    // Same gate the cached lookup applies: an archived page whose translation
    // still carries `is_published` is not public.
    const result = await getPage(slug, locale);
    return isPublishedPage(result) ? result : null;
  } catch {
    return null;
  }
});

/**
 * `projects/<slug>` is where a project's editor page is stored, but it is
 * served at `/projects/<slug>` by its own route, never from here: a deeper path
 * (or a stray row) must not render under another URL.
 */
const RESERVED_PREFIX = "projects/";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: segments } = await params;
  if (!segments || segments.length === 0) {
    return {};
  }
  const slug = segments.join("/");
  if (slug.startsWith(RESERVED_PREFIX)) {
    return {};
  }
  const locale = await getLocale();
  const result = await resolvePage(slug, locale);
  // Same guard as the page body: a page that 404s carries no title.
  if (!isRenderablePage(result)) {
    return {};
  }
  const title = result.translation.title;
  const description = result.translation.description ?? undefined;
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
  if (slug.startsWith(RESERVED_PREFIX)) {
    notFound();
  }
  const locale = await getLocale();
  const result = await resolvePage(slug, locale);

  if (!isRenderablePage(result)) {
    notFound();
  }

  // Normalize, sanitize, feeds, prune and theme are one pipeline shared with
  // the unit and project routes. A page bound to a department wears the
  // department's theme; otherwise its own. See `@/lib/published-editor-page`.
  return renderPublishedEditorPage({
    departmentTheme: await boundDepartmentTheme(result),
    locale,
    result,
    slug,
  });
}
