import type { ContentTranslations, Events } from "@repo/api/types/appwrite";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getCollectionEvents, getEventBySlug } from "@/app/actions/events";
import { getLocale } from "@/app/actions/locale";
import { EventActions } from "@/components/events/event-actions";
import { EventCollectionList } from "@/components/events/event-collection-list";
import { EventContent } from "@/components/events/event-content";
import { EventHero } from "@/components/events/event-hero";
import {
  EventContactCard,
  EventDetailsCard,
  EventImportantInfoCard,
  EventPriceCard,
} from "@/components/events/event-info-cards";
import { formatEventPrice } from "@/lib/types/event";

interface EventPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function EventDetails({ slug }: { slug: string }) {
  const locale = await getLocale();

  const event = await getEventBySlug(slug, locale);
  console.log("Fetched event:", event);
  if (!event) {
    notFound();
  }

  let collectionEvents: Events[] | null = null;
  const eventData = event;
  const translation = Array.isArray(event.translation_refs)
    ? event.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && "title" in item
      )
    : null;
  const title = translation?.title ?? "Untitled";
  const description = translation?.description ?? "";

  if (eventData?.is_collection && eventData.collection_id) {
    collectionEvents = await getCollectionEvents(
      eventData.collection_id,
      locale
    );
  } else if (eventData?.collection_id) {
    collectionEvents = await getCollectionEvents(
      eventData.collection_id,
      locale
    );
  }

  const price = formatEventPrice(eventData?.price);

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <EventHero event={event} />

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 lg:col-span-2">
            <EventContent event={event} />

            {collectionEvents && collectionEvents.length > 0 && (
              <EventCollectionList
                collectionEvents={collectionEvents}
                collectionPricing={eventData?.collection_pricing || null}
                currentEventId={event.$id}
                isCollectionParent={!!eventData?.is_collection}
                priceDisplay={price}
              />
            )}

            <EventImportantInfoCard price={price} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <EventPriceCard
              collectionCount={collectionEvents?.length || 0}
              event={event}
              isMember={false}
            />

            <EventActions
              description={description}
              ticketUrl={eventData?.ticket_url}
              title={title}
            />

            <EventDetailsCard event={event} />
            <EventContactCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function EventDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <div className="relative h-[50vh]">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  return (
    <Suspense fallback={<EventDetailsSkeleton />}>
      <EventDetails slug={slug} />
    </Suspense>
  );
}

export async function generateMetadata({ params }: EventPageProps) {
  const locale = await getLocale();
  const { slug } = await params;
  const event = await getEventBySlug(slug, locale);

  if (!event) {
    return {
      title: "Event Not Found | BISO",
    };
  }

  const translation = Array.isArray(event.translation_refs)
    ? event.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && "title" in item
      )
    : null;

  return {
    title: `${translation?.title ?? "Event"} | BISO Events`,
    description: translation?.description ?? "",
  };
}
