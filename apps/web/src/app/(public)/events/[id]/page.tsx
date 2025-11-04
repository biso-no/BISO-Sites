import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getEvent, getCollectionEvents } from '@/app/actions/events'
import { getLocale } from '@/app/actions/locale'
import { EventDetailsClient } from '@/components/events/event-details-client'
import { Skeleton } from '@repo/ui/components/ui/skeleton'

interface EventPageProps {
  params: {
    id: string
  }
}

async function EventDetails({ id }: { id: string }) {
  const locale = await getLocale()
  
  // Fetch the event
  const event = await getEvent(id, locale)
  
  if (!event) {
    notFound()
  }
  
  // Fetch collection events if this event belongs to or is a collection
  let collectionEvents = null
  const eventData = event.event_ref
  
  if (eventData?.is_collection && eventData.collection_id) {
    // This is a collection parent - fetch all its child events
    collectionEvents = await getCollectionEvents(eventData.collection_id, locale)
  } else if (eventData?.collection_id) {
    // This is a child event - fetch all events in the same collection
    collectionEvents = await getCollectionEvents(eventData.collection_id, locale)
  }
  
  return <EventDetailsClient event={event} collectionEvents={collectionEvents || undefined} />
}

function EventDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <div className="relative h-[50vh]">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
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
  )
}

export default async function EventPage({ params }: EventPageProps) {
  return (
    <Suspense fallback={<EventDetailsSkeleton />}>
      <EventDetails id={params.id} />
    </Suspense>
  )
}

// Generate metadata for SEO
export async function generateMetadata({ params }: EventPageProps) {
  const locale = await getLocale()
  const event = await getEvent(params.id, locale)
  
  if (!event) {
    return {
      title: 'Event Not Found | BISO',
    }
  }
  
  return {
    title: `${event.title} | BISO Events`,
    description: event.description,
  }
}
