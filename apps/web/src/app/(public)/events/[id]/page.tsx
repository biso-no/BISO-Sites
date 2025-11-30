import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getCollectionEvents, getEvent } from "@/app/actions/events";
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

type EventPageProps = {
  params: {
    id: string;
  };
};

async function EventDetails({ id }: { id: string }) {
  const locale = await getLocale();

  // Fetch the event
  const event = await getEvent(id, locale);

  if (!event) {
    notFound();
  }

  // Fetch collection events if this event belongs to or is a collection
  let collectionEvents: ContentTranslations[] | null = null;
  const eventData = event.event_ref;

  if (eventData?.is_collection && eventData.collection_id) {
    // This is a collection parent - fetch all its child events
    collectionEvents = await getCollectionEvents(
      eventData.collection_id,
      locale
    );
  } else if (eventData?.collection_id) {
    // This is a child event - fetch all events in the same collection
    collectionEvents = await getCollectionEvents(
      eventData.collection_id,
      locale
    );
  }

  const price = formatEventPrice(eventData?.price);

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
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
              description={event.description}
              ticketUrl={eventData?.ticket_url}
              title={event.title}
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
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
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

export default function EventPage({ params }: EventPageProps) {
  return (
    <Suspense fallback={<EventDetailsSkeleton />}>
      <EventDetails id={params.id} />
    </Suspense>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: EventPageProps) {
  const locale = await getLocale();
  const event = await getEvent(params.id, locale);

  if (!event) {
    return {
      title: "Event Not Found | BISO",
    };
  }

  return {
    title: `${event.title} | BISO Events`,
    description: event.description,
  };
}
