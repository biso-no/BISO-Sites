import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { listEvents } from "@/app/actions/events";
import { getLocale } from "@/app/actions/locale";
import { EventsHero } from "@/components/events/events-hero";
import { EventsListClient } from "@/components/events/events-list-client";

// This is a server component
export const metadata = {
  title: "Events | BISO",
  description:
    "Discover amazing events and experiences at BI Norwegian Business School",
};

async function EventsList({ locale }: { locale: "en" | "no" }) {
  // Fetch events on the server
  const events = await listEvents({
    locale,
    status: "published",
    limit: 50,
  });
  console.log("Events: ", events);

  return <EventsListClient events={events} />;
}

function EventsListSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function EventsPage() {
  const locale = await getLocale();

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <EventsHero />

      <Suspense fallback={<EventsListSkeleton />}>
        <EventsList locale={locale} />
      </Suspense>
    </div>
  );
}
