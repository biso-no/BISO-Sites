/**
 * Mega-nav "featured" slot construction, shared by two callers:
 * - `cachedNavFeatured` (public-content.ts): guest client inside "use cache",
 *   one cached result for all anonymous visitors.
 * - `sessionNavFeatured` (below): per-request session client for signed-in
 *   visitors, so member-only content (row perms `team:biso-members`) still
 *   surfaces in their nav. Session holders are human-volume traffic — the
 *   worker-pool deadlock came from cookieless bots/monitors, which never
 *   take this path.
 */

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Events, LargeEvent, News } from "@repo/api/types/appwrite";
import { getPrimaryTranslation } from "@/lib/content-translation";
import type { NavFeatured, NavFeaturedItem } from "@/lib/types/nav";
import { type Db, type PublicLocale, queryEvents, queryNews } from "./queries";

const FEATURED_EVENT_POOL = 6;

function toFeaturedEvent(
  events: Events[],
  locale: PublicLocale
): NavFeaturedItem | null {
  const now = Date.now();
  const upcoming = events
    .map((event) => ({
      event,
      time: event.start_date ? new Date(event.start_date).getTime() : null,
    }))
    .filter(
      (entry): entry is { event: Events; time: number } =>
        entry.time !== null && entry.time >= now && Boolean(entry.event.slug)
    )
    .sort((a, b) => a.time - b.time);

  const next = upcoming[0]?.event;
  if (!next?.slug) {
    return null;
  }

  const translation = getPrimaryTranslation(next, locale);
  return {
    title: translation?.title ?? "",
    slug: next.slug,
    image: next.image ?? null,
    startDate: next.start_date ?? null,
  };
}

function toFeaturedNews(
  news: News[],
  locale: PublicLocale
): NavFeaturedItem | null {
  const item = news[0];
  if (!item?.slug) {
    return null;
  }
  const translation = getPrimaryTranslation(item, locale);
  return {
    title: translation?.title ?? "",
    slug: item.slug,
    image: item.image ?? null,
  };
}

function toFeaturedProject(rows: LargeEvent[]): NavFeaturedItem | null {
  const project = rows[0];
  if (!project?.slug) {
    return null;
  }
  return {
    title: project.name,
    slug: project.slug,
    image: project.backgroundImageUrl ?? project.logoUrl ?? null,
  };
}

export async function buildNavFeatured(
  db: Db,
  locale: PublicLocale
): Promise<NavFeatured> {
  const [events, projects, news] = await Promise.all([
    queryEvents(db, {
      limit: FEATURED_EVENT_POOL,
      locale,
      status: "published",
    }).catch(() => [] as Events[]),
    db
      .listRows<LargeEvent>("app", "large_event", [
        Query.equal("isActive", true),
        Query.orderDesc("priority"),
        Query.limit(1),
      ])
      .then((res) => res.rows)
      .catch(() => [] as LargeEvent[]),
    queryNews(db, { limit: 1, locale, status: "published" }).catch(
      () => [] as News[]
    ),
  ]);

  return {
    event: toFeaturedEvent(events, locale),
    project: toFeaturedProject(projects),
    news: toFeaturedNews(news, locale),
  };
}

/** Per-request variant for signed-in visitors (session row permissions). */
export async function sessionNavFeatured(
  locale: PublicLocale
): Promise<NavFeatured> {
  const { db } = await createSessionClient();
  return await buildNavFeatured(db, locale);
}
