import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { listEvents } from "@/app/actions/events";
import { getLocale } from "@/app/actions/locale";
import { EventsHero } from "@/components/events/events-hero";
import { EventsListClient } from "@/components/events/events-list-client";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getUserPreferences } from "@/lib/auth-utils";

// This is a server component
export const metadata = {
  title: "Events | BISO",
  description:
    "Discover amazing events and experiences at BI Norwegian Business School",
};

async function EventsList({ locale }: { locale: "en" | "no" }) {
  // Fetch events on the server
  const [userPrefs, membership] = await Promise.all([
    getUserPreferences(),
    getMembershipStatus(),
  ]);
  // `upcomingOnly` is a real server-side filter: `queryEvents` expresses "has
  // not finished yet" as a three-armed `Query.or` over end_date/start_date, so
  // there is no post-fetch pass here to overfetch for. `isMember` is threaded
  // from the membership status already resolved above — omitting it would
  // hide member-only events from members, which is exactly the regression
  // this call was fixed to stop reproducing. This page still gets one page
  // (`WEB_PAGE_SIZE`) per request; Task 9 adds load-more pagination here.
  const { rows: events } = await listEvents({
    locale,
    status: "published",
    campus: userPrefs?.campusId ?? "all",
    upcomingOnly: true,
    isMember: membership.isMember,
  });

  return <EventsListClient events={events} isMember={membership.isMember} />;
}

function EventsListSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {[...new Array(6)].map((_, i) => (
          <div className="space-y-4" key={i}>
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
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <EventsHero />

      <Suspense fallback={<EventsListSkeleton />}>
        <EventsList locale={locale} />
      </Suspense>
    </div>
  );
}
