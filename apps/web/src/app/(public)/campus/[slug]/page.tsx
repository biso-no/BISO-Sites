import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCampusMetadata } from "@/app/actions/campus";
import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { listNews } from "@/app/actions/news";
import { CampusLanding } from "@/components/campus/v2/campus-landing";
import { CAMPUS_SLUGS, campusSlugToId } from "@/lib/campus-scope";
import { campusUnits } from "@/lib/data/campus-landing";
import {
  cachedHomeCounts,
  cachedShellCampuses,
} from "@/lib/data/public-content";

/**
 * A campus as a place you can link to.
 *
 * The chosen design states "YOU ARE ON CAMPUS OSLO" above campus-scoped
 * content, which is only honest if that page has a URL — before this, campus
 * lived entirely in a cookie and no campus view could be shared or bookmarked
 * (`00-current-state.md` §11.3).
 *
 * RD-016 gave the campus a URL; RD-023 gives it a page. The plan expected to
 * find that page half-built — 13 components in `campus/components/` that
 * nothing links to — and it expected `campus_metadata` to be "content that
 * already exists and is barely used". **Neither is true.** `campus_metadata`
 * and `campus_data` are both empty tables, and the tabbed experience is built
 * on them, so restyling it would have restyled a page with nothing in it.
 * What this renders instead is everything about a campus that *is* real: who
 * to write to, what is on, what has been written, what is open, and which
 * units are here. See PLACEHOLDER-009.
 */
// No `dynamicParams = false` — it is incompatible with `cacheComponents`.
// An unknown slug still 404s: `loadCampus` returns null and the page calls
// `notFound()`.
export function generateStaticParams() {
  return CAMPUS_SLUGS.map((slug) => ({ slug }));
}

interface Params {
  params: Promise<{ slug: string }>;
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
  return {
    id,
    slug,
    locale,
    name: campus.name,
    // `campus.email` is the campus president's address and the one piece of
    // contact data that exists — `campus_metadata` and `campus_data` are both
    // empty tables (PLACEHOLDER-009).
    email: campus.email ?? null,
    tagline: meta?.[`tagline${suffix}`] ?? null,
    description: meta?.[`description${suffix}`] ?? null,
    highlights: meta?.[`highlights${suffix}`] ?? [],
    focusAreas: meta?.[`focusAreas${suffix}`] ?? [],
  };
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
  const { slug } = await params;
  const campus = await loadCampus(slug);

  if (!campus) {
    notFound();
  }

  // Every feed that can be campus-scoped, scoped. `/projects` has no
  // `campus_id` to filter on, so it is not offered here.
  // `events` and `jobs` are capped for the preview blocks; the stat row needs
  // campus-wide totals, so those are read separately rather than inferred from
  // the preview lengths.
  const [events, news, jobs, units, counts] = await Promise.all([
    listEvents({
      status: "published",
      limit: 4,
      locale: campus.locale,
      campus: campus.id,
    }),
    listNews({
      status: "published",
      limit: 4,
      locale: campus.locale,
      campus: campus.id,
    }),
    listJobs({
      status: "published",
      limit: 3,
      locale: campus.locale,
      campus: campus.id,
    }),
    campusUnits(campus.id),
    cachedHomeCounts(campus.id),
  ]);

  return (
    <CampusLanding
      description={campus.description}
      email={campus.email}
      eventCount={counts.eventCount}
      events={events}
      focusAreas={campus.focusAreas}
      highlights={campus.highlights}
      jobCount={counts.jobCount}
      jobs={jobs}
      locale={campus.locale}
      name={campus.name}
      news={news}
      slug={campus.slug}
      units={units}
    />
  );
}
