"use server";

import { getPrimaryTranslation } from "@/lib/content-translation";
import type { NavFeatured, NavFeaturedItem } from "@/lib/types/nav";
import { listEvents } from "./events";
import { listLargeEvents } from "./large-events";
import { getLocale } from "./locale";
import { listNews } from "./news";

const FEATURED_EVENT_POOL = 6;

async function getFeaturedEvent(
  locale: "en" | "no"
): Promise<NavFeaturedItem | null> {
  try {
    const events = await listEvents({
      status: "published",
      limit: FEATURED_EVENT_POOL,
      locale,
    });

    const now = Date.now();
    const upcoming = events
      .map((event) => ({
        event,
        time: event.start_date ? new Date(event.start_date).getTime() : null,
      }))
      .filter(
        (entry): entry is { event: (typeof events)[number]; time: number } =>
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
  } catch (error) {
    console.error("getNavFeatured: failed to load featured event", error);
    return null;
  }
}

async function getFeaturedProject(): Promise<NavFeaturedItem | null> {
  try {
    const projects = await listLargeEvents({ activeOnly: true, limit: 1 });
    const project = projects[0];
    if (!project?.slug) {
      return null;
    }

    return {
      title: project.name,
      slug: project.slug,
      image: project.backgroundImageUrl ?? project.logoUrl ?? null,
    };
  } catch (error) {
    console.error("getNavFeatured: failed to load featured project", error);
    return null;
  }
}

async function getFeaturedNews(
  locale: "en" | "no"
): Promise<NavFeaturedItem | null> {
  try {
    const news = await listNews({ status: "published", limit: 1, locale });
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
  } catch (error) {
    console.error("getNavFeatured: failed to load featured news", error);
    return null;
  }
}

export async function getNavFeatured(): Promise<NavFeatured> {
  const locale = await getLocale();

  const [event, project, news] = await Promise.all([
    getFeaturedEvent(locale),
    getFeaturedProject(),
    getFeaturedNews(locale),
  ]);

  return { event, project, news };
}
