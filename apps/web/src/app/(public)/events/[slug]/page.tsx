import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  getCollectionEvents,
  getEventDetailBySlug,
} from "@/app/actions/events";
import { getLocale } from "@/app/actions/locale";
import { EventDetailV2 } from "@/components/events/v2/event-detail-v2";
import { DetailSkeleton } from "@/components/ui/loading-shell";

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

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <EventDetailsV2 slug={slug} />
    </Suspense>
  );
}
