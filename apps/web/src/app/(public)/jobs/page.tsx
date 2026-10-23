import {
  firstParam,
  type ListSearchParams,
} from "@repo/shared/utils/list-params";
import {
  parseUnitCategory,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { type JobSort, listJobFacets, listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { JobsV2 } from "@/components/jobs/v2/jobs-v2";
import { FeedSkeleton } from "@/components/ui/loading-shell";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";
import { parseWebListParams } from "@/lib/list-params";

export const metadata = {
  // A campus-scoped feed is a filtered view of the same collection, so it
  // points its canonical at the unscoped URL rather than competing with it.
  alternates: { canonical: "/jobs" },
  title: "Join Our Team | BISO",
  description: "Discover open positions at BISO and apply today.",
};

interface JobsPageProps {
  searchParams: Promise<ListSearchParams>;
}

const asSort = (value: string | undefined): JobSort =>
  value === "deadline" ? "deadline" : "newest";

async function JobsList({
  campus,
  category,
  department,
  locale,
  page,
  search,
  searchParams,
  sort,
}: {
  campus: string | null;
  category: UnitCategory | null;
  department: string | null;
  locale: string;
  page: number;
  search: string;
  searchParams: ListSearchParams;
  sort: JobSort;
}) {
  // `openVacancyQueries` builds its deadline filter from `new Date()`, which the
  // Cache Components prerender rejects as an unstable value
  // (`blocking-prerender-current-time`). Marking this subtree request-time is
  // enough — it sits inside the page's <Suspense>, so the skeleton still
  // streams and the route itself stays non-blocking.
  await connection();

  const filters = { campus, category, department, locale, search, sort };
  const [requested, facets] = await Promise.all([
    listJobs({ ...filters, page }),
    listJobFacets({ campus }),
  ]);
  // A page past the last one (a stale or hand-edited `?page=`) renders the
  // first page instead of an empty grid — the same clamp `parseWebListParams`
  // applies to junk in the address bar. Judged by the rows, not `total`,
  // which Appwrite can report for the whole table.
  const result =
    requested.rows.length === 0 && page > 1
      ? await listJobs({ ...filters, page: 1 })
      : requested;

  return (
    <JobsV2
      campusId={campus}
      category={category}
      department={department}
      facets={facets}
      locale={locale}
      result={result}
      search={search}
      searchParams={searchParams}
      sort={sort}
    />
  );
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const [sp, prefs, locale] = await Promise.all([
    searchParams,
    getUserPreferences(),
    getLocale(),
  ]);

  // Locale comes from `getLocale()`, not from user preferences.
  // `getUserPreferences()` returns no locale when the visitor has never set
  // one, and the `?? "en"` fallback beneath it disagreed with `DEFAULT_LOCALE`,
  // which is `"no"` — so a first visit rendered Norwegian chrome over English
  // content. The chrome reads `getLocale()`; the data must read the same thing.
  // URL beats cookie beats "all". This route already accepted `?campus=1`;
  // `resolveRequestCampus` keeps that working and adds slugs (`?campus=oslo`),
  // and now 404s an unrecognised value instead of passing it to the query,
  // where it silently matched nothing.
  const campus = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campus === undefined) {
    notFound();
  }

  const { page, q } = parseWebListParams(sp);

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <JobsList
        campus={campus}
        // Normalised onto a canonical category (`department.type` values), so
        // an unknown value is no filter rather than an empty list.
        category={parseUnitCategory(firstParam(sp, "category"))}
        department={firstParam(sp, "department") || null}
        locale={locale}
        page={page}
        search={q}
        searchParams={sp}
        sort={asSort(firstParam(sp, "sort"))}
      />
    </Suspense>
  );
}
