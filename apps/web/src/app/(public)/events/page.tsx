import type { EventsCategory } from "@repo/api/types/appwrite";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { listEventFacets, listEvents } from "@/app/actions/events";
import { getLocale } from "@/app/actions/locale";
import {
  firstPageTotal,
  parseCategory,
} from "@/components/events/v2/event-fields";
import { EventsV2 } from "@/components/events/v2/events-v2";
import { FeedSkeleton } from "@/components/ui/loading-shell";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";
import { parseWebListParams, WEB_PAGE_SIZE } from "@/lib/list-params";

export const metadata: Metadata = {
  // A campus-scoped feed is a filtered view of the same collection, so it
  // points its canonical at the unscoped URL rather than competing with it.
  alternates: { canonical: "/events" },
  title: "Events | BISO",
  description:
    "Discover amazing events and experiences at BI Norwegian Business School",
};

type EventsSearchParams = Record<string, string | string[] | undefined>;

/**
 * The search term. `?q=` is what the feed reads and what its form submits —
 * the name main's list actions use. `?search=` was the redesign's name for the
 * same thing, so links made with it keep working.
 */
function searchTerm(sp: EventsSearchParams): string {
  const { q } = parseWebListParams(sp);
  if (q) {
    return q;
  }
  const legacy = Array.isArray(sp.search) ? sp.search[0] : sp.search;
  return legacy?.trim() ?? "";
}

async function EventsListV2({
  campus,
  category,
  locale,
  search,
  searchParams,
}: {
  campus: string | null;
  category: EventsCategory | null;
  locale: "en" | "no";
  search: string;
  searchParams: EventsSearchParams;
}) {
  const campusKey = campus ?? "all";
  // Page 1 is always rendered here; "Load more" fetches the rest through the
  // same action. `upcomingOnly` filters finished events out and orders by
  // start date in the query. `isMember` never narrows anything — members-only
  // events are listed for everyone — it only picks the price a card leads with.
  const [result, facets, membership] = await Promise.all([
    listEvents({
      campus: campusKey,
      category,
      locale,
      search,
      status: "published",
      upcomingOnly: true,
    }),
    listEventFacets({ campus: campusKey }),
    getMembershipStatus(),
  ]);

  const total = firstPageTotal(result.rows.length, result.total, WEB_PAGE_SIZE);

  return (
    <EventsV2
      campusId={campus}
      capped={result.capped}
      categories={facets.categories}
      category={category}
      events={result.rows}
      isMember={membership.isMember}
      locale={locale}
      search={search}
      searchParams={searchParams}
      total={total}
    />
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<EventsSearchParams>;
}) {
  const [locale, sp, prefs] = await Promise.all([
    getLocale(),
    searchParams,
    getUserPreferences(),
  ]);

  // URL beats cookie beats "all". An unrecognised campus is a 404, not a
  // silent fallback to everything — see `resolveRequestCampus`.
  const campus = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campus === undefined) {
    notFound();
  }

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <EventsListV2
        campus={campus}
        category={parseCategory(sp.category)}
        locale={locale}
        search={searchTerm(sp)}
        searchParams={sp}
      />
    </Suspense>
  );
}
