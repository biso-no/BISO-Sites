import type { CampusData } from "@repo/api/types/appwrite";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getCampusData, getCampusMetadata } from "@/app/actions/campus";
import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { listNews } from "@/app/actions/news";
import { CampusLanding } from "@/components/campus/v2/campus-landing";
import { localizedFocusAreas } from "@/lib/campus-leadership";
import { CAMPUS_SLUGS, campusSlugToId } from "@/lib/campus-scope";
import { campusLeadership } from "@/lib/data/campus-leadership";
import {
  cachedHomeCounts,
  cachedShellCampuses,
} from "@/lib/data/public-content";
import { cachedPublicUnits } from "@/lib/data/units";

/**
 * A campus as a place you can link to.
 *
 * The chosen design states "YOU ARE ON CAMPUS OSLO" above campus-scoped
 * content, which is only honest if that page has a URL — before this, campus
 * lived entirely in a cookie and no campus view could be shared or bookmarked
 * (`00-current-state.md` §11.3).
 *
 * RD-016 gave the campus a URL; RD-023 gave it a page; the merge with main
 * moved the old `/campus` tabs onto it — the management board, the campus's
 * student benefits and units, and its partnership offer. Every editorial field
 * renders only when it has data (PLACEHOLDER-009): `campus_metadata` and
 * `campus_data` were empty when the page was built, and the page fills itself
 * in as those rows are written.
 */
// No `dynamicParams = false` — it is incompatible with `cacheComponents`.
// An unknown slug still 404s: `loadCampus` returns null and the page calls
// `notFound()`.
export function generateStaticParams() {
  return CAMPUS_SLUGS.map((slug) => ({ slug }));
}

// Upcoming events and open positions are both filtered against `new Date()`,
// which the Cache Components prerender rejects as an unstable value, and the
// page fetches every block up front with no Suspense boundary. `instant =
// false` lets it block (so an unknown slug is still a real 404) and
// `connection()` below defers the clock read to request time — both are
// needed, as on `/students`.
export const instant = false;

/** Preview sizes; each block links to its full, campus-scoped feed. */
const EVENTS_PREVIEW = 4;
const NEWS_PREVIEW = 4;
const JOBS_PREVIEW = 3;

interface Params {
  params: Promise<{ slug: string }>;
}

/** The visitor's language first, the other as fallback, field by field. */
function pick<T>(
  preferred: T | null | undefined,
  fallback: T | null | undefined
): T | null {
  const isEmpty = (value: T | null | undefined) =>
    value == null || (Array.isArray(value) && value.length === 0);
  if (!isEmpty(preferred)) {
    return preferred as T;
  }
  return isEmpty(fallback) ? null : (fallback as T);
}

async function loadCampus(slug: string) {
  const id = campusSlugToId(slug);
  if (!id) {
    return null;
  }
  const [campuses, metadata, locale] = await Promise.all([
    cachedShellCampuses(),
    getCampusMetadata(),
    getLocale(),
  ]);
  const campus = campuses.find((c) => c.$id === id);
  if (!campus) {
    return null;
  }
  const meta = metadata[id];
  const suffix = locale === "no" ? "_nb" : "_en";
  const other = locale === "no" ? "_en" : "_nb";
  return {
    id,
    slug,
    locale,
    name: campus.name,
    // `campus.email` is the campus president's address and the one piece of
    // contact data every campus has.
    email: campus.email ?? null,
    tagline: pick(meta?.[`tagline${suffix}`], meta?.[`tagline${other}`]),
    description: pick(
      meta?.[`description${suffix}`],
      meta?.[`description${other}`]
    ),
    highlights:
      pick(meta?.[`highlights${suffix}`], meta?.[`highlights${other}`]) ?? [],
    focusAreas: localizedFocusAreas(meta ?? null, locale),
  };
}

/** This campus's `campus_data` row, by id or by name. */
function campusDataFor(
  rows: CampusData[],
  id: string,
  name: string
): CampusData | null {
  const wanted = name.toLowerCase();
  return (
    rows.find(
      (row) =>
        row.$id === id ||
        row.name?.toLowerCase() === wanted ||
        row.name_nb?.toLowerCase() === wanted
    ) ?? null
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const campus = await loadCampus(slug);
  if (!campus) {
    return { title: "Campus | BISO" };
  }
  return {
    title: `BISO ${campus.name} | BI Student Organisation`,
    description: campus.description ?? campus.tagline ?? undefined,
  };
}

export default async function CampusPage({ params }: Params) {
  // Must precede the fetches: see `instant` above.
  await connection();

  const { slug } = await params;
  const campus = await loadCampus(slug);

  if (!campus) {
    notFound();
  }

  // Every feed that can be campus-scoped, scoped — the list actions run
  // `campusScopeIds`, so National rides along. `/projects` has no `campus_id`
  // to filter on, so it is not offered here. The previews are capped; the stat
  // row reads campus-wide totals from `cachedHomeCounts`, which counts with the
  // same filters as the feeds the blocks link to (upcoming events, open roles).
  //
  // The cached readers throw rather than cache a failure, so each fallback
  // lives here and lasts for this render only: a failed directory read or an
  // unreachable board service drops that block, never the page.
  const [
    eventsResult,
    news,
    jobsResult,
    units,
    counts,
    leadership,
    campusDataRows,
  ] = await Promise.all([
    listEvents({
      locale: campus.locale,
      pageSize: EVENTS_PREVIEW,
      upcomingOnly: true,
      campus: campus.id,
    }),
    listNews({
      limit: NEWS_PREVIEW,
      locale: campus.locale,
      campus: campus.id,
    }),
    listJobs({
      locale: campus.locale,
      pageSize: JOBS_PREVIEW,
      campus: campus.id,
    }),
    cachedPublicUnits(campus.locale).catch(() => null),
    cachedHomeCounts(campus.id, campus.locale).catch(() => null),
    campusLeadership(campus.id).catch(() => []),
    getCampusData().catch((): CampusData[] => []),
  ]);

  return (
    <CampusLanding
      campusData={campusDataFor(campusDataRows, campus.id, campus.name)}
      description={campus.description ?? campus.tagline}
      email={campus.email}
      eventCount={counts?.eventCount ?? null}
      events={eventsResult.rows}
      focusAreas={campus.focusAreas}
      highlights={campus.highlights}
      id={campus.id}
      jobCount={counts?.jobCount ?? null}
      jobs={jobsResult.rows}
      leadership={leadership}
      locale={campus.locale}
      name={campus.name}
      news={news}
      slug={campus.slug}
      units={(units ?? []).filter((unit) => unit.campusId === campus.id)}
    />
  );
}
