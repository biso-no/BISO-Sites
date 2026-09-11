import type { ListSearchParams } from "@repo/shared/utils/list-params";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { listEventFacets, listEvents } from "@/app/actions/events";
import { getLocale } from "@/app/actions/locale";
import { EventsHero } from "@/components/events/events-hero";
import { EventsListClient } from "@/components/events/events-list-client";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getUserPreferences } from "@/lib/auth-utils";
import { parseWebListParams } from "@/lib/list-params";

// This is a server component
export const metadata = {
  title: "Events | BISO",
  description:
    "Discover amazing events and experiences at BI Norwegian Business School",
};

interface EventsPageProps {
  searchParams: Promise<ListSearchParams>;
}

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

async function EventsList({
  campus,
  category,
  isMember,
  locale,
  page,
  search,
}: {
  campus: string;
  category: string | null;
  isMember: boolean;
  locale: "en" | "no";
  page: number;
  search: string;
}) {
  // `upcomingOnly` is a real server-side filter: `queryEvents` expresses "has
  // not finished yet" as a three-armed `Query.or` over end_date/start_date, so
  // there is no post-fetch pass here to overfetch for. `isMember` never
  // narrows the list (members-only events are shown to everyone); it only
  // drives member pricing and the members-only notice in the client.
  const [result, facets] = await Promise.all([
    listEvents({
      campus,
      category,
      locale,
      page,
      search,
      status: "published",
      upcomingOnly: true,
    }),
    listEventFacets({ campus }),
  ]);

  return (
    <EventsListClient
      campus={campus}
      capped={result.capped}
      categories={facets.categories}
      initialEvents={result.rows}
      initialSearch={search}
      isMember={isMember}
      // Remounts on any filter change so the load-more list resets to the
      // new page 1 instead of appending onto the previous filter's rows.
      key={`${campus}|${category}|${search}`}
      locale={locale}
      selectedCategory={category}
      total={result.total}
    />
  );
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

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const [sp, locale, prefs, membership] = await Promise.all([
    searchParams,
    getLocale(),
    getUserPreferences(),
    getMembershipStatus(),
  ]);
  const { page, q } = parseWebListParams(sp);
  const campus = first(sp.campus) ?? prefs?.campusId ?? "all";
  const category = first(sp.category) ?? null;

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <EventsHero />
      <Suspense
        fallback={<EventsListSkeleton />}
        key={`${campus}|${q}|${page}`}
      >
        <EventsList
          campus={campus}
          category={category}
          isMember={membership.isMember}
          locale={locale}
          page={page}
          search={q}
        />
      </Suspense>
    </div>
  );
}
