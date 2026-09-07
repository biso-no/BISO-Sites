import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  getCollectionEvents,
  getEventDetailBySlug,
} from "@/app/actions/events";
import { getLocale } from "@/app/actions/locale";
import { EventDetailV2 } from "@/components/events/v2/event-detail-v2";
import { pickContent } from "@/components/events/v2/event-fields";
import { DetailSkeleton } from "@/components/ui/loading-shell";
import { toPlainText } from "@/lib/content-text";
import { buildSummary } from "@/lib/news-article";

interface EventPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function EventDetailsV2({ slug }: { slug: string }) {
  const [locale, event] = await Promise.all([
    getLocale(),
    getEventDetailBySlug(slug),
  ]);
  if (!event) {
    notFound();
  }

  // Both a collection parent and one of its children want the sibling list.
  const collectionEvents = event.collection_id
    ? await getCollectionEvents(event.collection_id, locale)
    : [];

  return (
    <EventDetailV2
      collectionEvents={collectionEvents}
      event={event}
      locale={locale}
    />
  );
}

/**
 * Event tabs, shared links and search results need the event's own title, not
 * the root layout's. The v1 route exported this and the rewrite dropped it, so
 * every event detail page inherited the generic site title — caught in review
 * of the redesign PR.
 *
 * Uses `pickContent`, the same reader the page body renders with, so the tab
 * title and the `<h1>` cannot disagree about which translation won.
 */
export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [locale, event] = await Promise.all([
      getLocale(),
      getEventDetailBySlug(slug),
    ]);
    if (!event) {
      return { title: "Event | BISO" };
    }

    const content = pickContent(event.translation_refs, locale);
    if (!content.title) {
      return { title: "Event | BISO" };
    }

    const description = buildSummary(
      content.shortDescription,
      toPlainText(content.description)
    );

    return {
      title: `${content.title} | BISO Events`,
      description,
      openGraph: {
        type: "website",
        title: content.title,
        description,
        images: event.image ? [event.image] : undefined,
      },
    };
  } catch {
    return { title: "Event | BISO" };
  }
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <EventDetailsV2 slug={slug} />
    </Suspense>
  );
}
