import type { CampusMetadata } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { campusIdToLabel } from "@repo/shared/utils/unit-urls";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { HomeV2 } from "@/components/home/v2/home-v2";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getUserPreferences } from "@/lib/auth-utils";
import {
  leadershipCampusId,
  localizedFocusAreas,
  managementDepartmentId,
} from "@/lib/campus-leadership";
import { NATIONAL_CAMPUS_ID, resolveRequestCampus } from "@/lib/campus-scope";
import { SESSION_COOKIE } from "@/lib/cookie-prefs";
import { getMembershipTextItems } from "@/lib/data/membership-texts";
import {
  cachedCampusMetadata,
  cachedHomeCounts,
  cachedOpenJobs,
  cachedPartners,
  cachedPublishedEvents,
  cachedPublishedNews,
  cachedShellCampuses,
} from "@/lib/data/public-content";
import { cachedPublicUnits } from "@/lib/data/units";
import { listEvents } from "../actions/events";
import { getLocale } from "../actions/locale";
import { listNews } from "../actions/news";

export const metadata: Metadata = {
  // `/?campus=bergen` is a filtered view of the front page, not a second front
  // page — same rule the other scoped feeds follow.
  alternates: { canonical: "/" },
  title: "BISO – BI Student Organisation",
  description:
    "BI Student Organisation (BISO) is the student association at BI Norwegian Business School — events, volunteer opportunities, student benefits, and campus life across Oslo, Bergen, Trondheim, and Stavanger.",
};

// Enough for the homepage grid — the full listing lives on /events.
const HOME_EVENTS_LIMIT = 12;
const HOME_NEWS_LIMIT = 3;
const HOME_JOBS_LIMIT = 3;

// Split feeds: anonymous visitors (all bot/monitor traffic) share the
// "use cache" guest result; session holders read per-request so their own
// campus/locale selection applies without waiting for the cache to catch up.
// Both feeds include members-only events: that flag limits who can join an
// event, not who can see it.
// `upcomingOnly` is now a precise server-side query (`queryEvents`'s
// three-armed `Query.or` over end_date/start_date), not a post-fetch filter —
// so this multiplier is no longer compensating for rows lost after the fetch.
// Kept as-is (asking for more than we render, then slicing) rather than
// removed, since this task is fixing the pagination/search regressions, not
// re-tuning the home page's fetch sizing.
const UPCOMING_OVERFETCH = 4;

function homeEvents(
  hasSession: boolean,
  locale: Locale,
  campusKey: string | null,
  limit: number
) {
  const fetchLimit = limit * UPCOMING_OVERFETCH;
  if (hasSession) {
    return listEvents({
      campus: campusKey ?? "all",
      locale,
      pageSize: fetchLimit,
      upcomingOnly: true,
    }).then((result) => result.rows.slice(0, limit));
  }
  return cachedPublishedEvents(locale, campusKey, fetchLimit)
    .then((events) => events.slice(0, limit))
    .catch(() => []);
}

function homeNews(
  hasSession: boolean,
  locale: Locale,
  campusKey: string | null,
  limit: number
) {
  if (hasSession) {
    return listNews({
      campus: campusKey ?? "all",
      limit,
      locale,
    });
  }
  return cachedPublishedNews(locale, campusKey, limit).catch(() => []);
}

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [sp, prefs, locale, cookieStore] = await Promise.all([
    searchParams,
    getUserPreferences(),
    getLocale(),
    cookies(),
  ]);
  // The front page is a campus-scoped feed like the rest: URL beats cookie
  // beats "all". It read the cookie alone before, so `/?campus=bergen` — the
  // URL the switcher now produces, and the one people share — was ignored.
  // An unrecognised campus 404s rather than silently showing everything.
  const campusKey = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campusKey === undefined) {
    notFound();
  }
  const hasSession = Boolean(cookieStore.get(SESSION_COOKIE));

  // The front page is the campus overview (Branding Committee, batch G): the
  // hero names the campus, then the overview with its live counts and focus
  // areas, the campus leadership, events, news, open roles and the unit grid,
  // then membership and partners — every slice scoped like the feeds, and all
  // but the session holders' events and news read through the guest cache.
  // Failures fall back per slice, at this call site, so a transient Appwrite
  // error renders an emptier homepage instead of a 500 and is never cached.
  // The leadership board is the one slice not awaited here: it loads inside
  // its own Suspense boundary, so a slow directory never holds the page.
  //
  // RD-030: the v1 hero carousel took its own smaller event/news slices; the
  // chevron hero has no slides, so those two round-trips stay gone.
  // `cachedShellCampuses` is the entry `SiteShell` already reads on every
  // request, so naming the campus costs no extra Appwrite call.
  // `getMembershipStatus` is memoised per request and the shell asks too, so
  // the membership CTAs cost nothing extra either.
  const boardCampusId = leadershipCampusId(campusKey);
  const [
    events,
    news,
    counts,
    partners,
    campuses,
    campusMetadata,
    jobs,
    units,
    membership,
    joinItems,
  ] = await Promise.all([
    homeEvents(hasSession, locale, campusKey, HOME_EVENTS_LIMIT),
    homeNews(hasSession, locale, campusKey, HOME_NEWS_LIMIT),
    cachedHomeCounts(campusKey, locale).catch(() => ({
      departmentCount: 0,
      eventCount: 0,
      jobCount: 0,
    })),
    cachedPartners().catch(() => []),
    cachedShellCampuses(),
    cachedCampusMetadata().catch((): Record<string, CampusMetadata> => ({})),
    cachedOpenJobs(campusKey, locale, HOME_JOBS_LIMIT).catch(() => []),
    cachedPublicUnits(locale).catch(() => []),
    getMembershipStatus(),
    getMembershipTextItems("home_join", locale),
  ]);

  // National is a scope, not a place: its copy is the no-campus copy.
  const campusName =
    campusKey && campusKey !== NATIONAL_CAMPUS_ID
      ? (campuses.find((campus) => campus.$id === campusKey)?.name ??
        campusIdToLabel(campusKey))
      : null;
  const campusUnits = campusKey
    ? units.filter((unit) => unit.campusId === campusKey)
    : units;
  const managementUnitId = managementDepartmentId(boardCampusId);
  const teamHref =
    units.find((unit) => unit.id === managementUnitId)?.href ?? null;

  return (
    <HomeV2
      campus={
        campusKey && campusName ? { id: campusKey, name: campusName } : null
      }
      counts={counts}
      events={events}
      focusAreas={localizedFocusAreas(
        campusMetadata[boardCampusId] ?? null,
        locale
      )}
      isMember={membership.isMember}
      jobs={jobs}
      joinItems={joinItems}
      leadership={{ campusId: boardCampusId, teamHref }}
      locale={locale}
      news={news}
      partners={partners}
      scopeCampusId={campusKey}
      units={campusUnits}
    />
  );
}
