import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import {
  UNIT_CATEGORY_MESSAGE_KEYS,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { unitDisplayName } from "@repo/shared/utils/unit-names";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { JobSort } from "@/app/actions/jobs";
import { FeedSearch } from "@/components/ui/feed-search";
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import type { WebPaginatedResult } from "@/lib/list-params";
import { JobCard, type JobCardLabels, toJobCardModel } from "./job-card";
import { JobsLoadMore } from "./jobs-load-more";
import { feedTotal } from "./paging";

/**
 * The jobs listing: a Server Component with link-based filters over a feed
 * that pages on the server.
 *
 * The page hands in the first page from `listJobs` (open vacancies filtered,
 * searched, scoped and sorted in the Appwrite query) and the filter options
 * from `listJobFacets`, which reads the whole open set — so a filter offers
 * what exists, not what happens to be on page one. Further pages are appended
 * by the `JobsLoadMore` island with the same card.
 *
 * Every filter is a URL parameter the query resolves: `?q=`, `?category=`
 * (the owning unit's category), `?department=` and `?sort=`. Employment type
 * and "paid only" are not offered — both live in the vacancy's JSON metadata,
 * which Appwrite cannot filter on, and filtering one page client-side would
 * leave holes in every later page.
 *
 * Campus has no row here. The header's campus switcher is the one place to
 * change it (Branding Committee, #95) and rewrites `?campus=` on this route;
 * every link and the search form carry the parameter along unchanged.
 *
 * Links rather than state: a filtered view is shareable, works before
 * hydration, and the back button steps through filter changes.
 */
export interface JobsV2Props {
  campusId: string | null;
  category: UnitCategory | null;
  department: string | null;
  facets: { categories: UnitCategory[]; departments: [string, string][] };
  locale: string;
  result: WebPaginatedResult<RecruitmentVacancy>;
  search: string;
  searchParams: Record<string, string | string[] | undefined>;
  sort: JobSort;
}

const ALL = "all";
const DEFAULT_SORT: JobSort = "newest";

/** Parameters the search form carries so a search keeps the other filters. */
const SEARCH_KEEPS = ["campus", "category", "department", "sort"] as const;

/** The filters a search submission must keep, from the URL as it stands. */
function searchHiddenFields(
  searchParams: Record<string, string | string[] | undefined>
): Record<string, string> {
  const hidden: Record<string, string> = {};
  for (const key of SEARCH_KEEPS) {
    const value = searchParams[key];
    if (typeof value === "string") {
      hidden[key] = value;
    }
  }
  return hidden;
}

/**
 * Clearing the filters keeps the campus the URL chose: scope is not a filter
 * the visitor typed, it is where they are.
 */
function clearFiltersHref(
  searchParams: Record<string, string | string[] | undefined>
): string {
  const campus = searchParams.campus;
  return typeof campus === "string"
    ? `/jobs?campus=${encodeURIComponent(campus)}`
    : "/jobs";
}

/** A filter change starts the list over, so no link carries `page` along. */
function withoutPage(
  searchParams: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> {
  return Object.fromEntries(
    Object.entries(searchParams).filter(([key]) => key !== "page")
  );
}

/**
 * Units are named for students with `unitDisplayName` (no campus prefix).
 * Across all campuses two units can then share a name, and two identical
 * chips would be a choice nobody can make — those keep the accounting name.
 */
function departmentOptions(
  departments: [string, string][],
  locale: string
): FilterOption[] {
  const named = departments.map(([id, name]) => ({
    id,
    name,
    display: unitDisplayName(name),
  }));
  const uses = new Map<string, number>();
  for (const { display } of named) {
    uses.set(display, (uses.get(display) ?? 0) + 1);
  }
  return named
    .map(({ id, name, display }) => ({
      value: id,
      label: (uses.get(display) ?? 0) > 1 ? name : display,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

/**
 * No roles at all reads as the season it is (with the interest address);
 * no roles for a search or filter offers the way back.
 */
function EmptyFeed({
  clearHref,
  copy,
  filtered,
}: {
  clearHref: string;
  copy: {
    body: string;
    clear: string;
    interest: string;
    title: string;
  };
  filtered: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-biso-md border border-edge p-10">
      <h2 className="type-heading-card text-ink">{copy.title}</h2>
      <p className="type-body max-w-(--measure) text-ink-muted">{copy.body}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <a className={statusPanelPrimaryAction} href="mailto:jobs@biso.no">
          {copy.interest}
        </a>
        {filtered ? (
          <Link className={statusPanelSecondaryAction} href={clearHref}>
            {copy.clear}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export async function JobsV2({
  campusId,
  category,
  department,
  facets,
  locale,
  result,
  search,
  searchParams,
  sort,
}: JobsV2Props) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("jobs"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const linkParams = withoutPage(searchParams);

  // The active category stays offered even when the campus has no open role
  // in it, so the applied filter is visible and can be cleared.
  const categories = [
    ...new Set([...facets.categories, ...(category ? [category] : [])]),
  ];
  const categoryOptions: FilterOption[] = [
    { value: ALL, label: t("filters.all") },
    ...categories.map((value) => ({
      value,
      label: t(`filters.${UNIT_CATEGORY_MESSAGE_KEYS[value]}`),
    })),
  ];

  // One unit is no choice: the row appears once roles span two or more.
  const unitOptions: FilterOption[] =
    facets.departments.length > 1
      ? [
          { value: ALL, label: t("filters.all") },
          ...departmentOptions(facets.departments, locale),
        ]
      : [];

  // `listJobs` reports Appwrite's total, which can be the whole table's; a
  // short page is the exact count (see `./paging`).
  const total = feedTotal({
    pageRows: result.rows.length,
    pageSize: result.size,
    reportedTotal: result.total,
    startPage: result.page,
  });

  // Ordering fewer than two roles changes nothing.
  const sortOptions: FilterOption[] =
    total > 1
      ? [
          { value: "newest", label: t("filters.sortNewest") },
          { value: "deadline", label: t("filters.sortDeadline") },
        ]
      : [];

  const labels: JobCardLabels = {
    deadline: t("card.deadline"),
    membersOnly: t("card.membersOnly"),
    paid: t("card.paid"),
  };
  const initial = result.rows.map((job) => toJobCardModel(job, locale));

  const filtered = Boolean(
    search || category || department || sort !== DEFAULT_SORT
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("links.jobs") },
        ]}
        lede={t("hero.subtitle")}
        title={t("hero.title")}
      />

      <Section tone="paper">
        <div className="mb-8 space-y-3">
          <FeedSearch
            action="/jobs"
            defaultValue={search}
            // A search must not silently drop the filters already applied.
            hidden={searchHiddenFields(searchParams)}
            label={t("filters.searchLabel")}
            name="q"
            placeholder={t("filters.searchPlaceholder")}
            submitLabel={t("filters.searchSubmit")}
            surface="jobs"
          />
          <FilterChips
            active={category ?? ALL}
            basePath="/jobs"
            label={t("filters.categoryLabel")}
            options={categoryOptions}
            param="category"
            searchParams={linkParams}
          />
          <FilterChips
            active={department ?? ALL}
            basePath="/jobs"
            label={t("filters.departmentLabel")}
            options={unitOptions}
            param="department"
            searchParams={linkParams}
          />
          <FilterChips
            active={sort}
            basePath="/jobs"
            defaultValue={DEFAULT_SORT}
            label={t("filters.sortLabel")}
            options={sortOptions}
            param="sort"
            searchParams={linkParams}
          />
        </div>

        <p className="type-body-sm mb-6 text-ink-muted">
          {/* A capped search counted only the first candidates it found, so
              the total is a floor and the visitor is told to narrow it. */}
          {result.capped
            ? t("filters.showingFirstResults", { count: total })
            : t("results.count", { count: total })}
        </p>

        {initial.length > 0 ? (
          <JobsLoadMore
            campus={campusId}
            category={category}
            department={department}
            firstPageIds={initial.map((job) => job.id)}
            // Remounts on any filter change so the appended pages reset to the
            // new filter's first page instead of continuing the old one.
            key={`${campusId ?? ALL}|${category ?? ALL}|${department ?? ALL}|${search}|${sort}|${result.page}`}
            labels={{
              ...labels,
              loadMore: t("filters.loadMore"),
              loadMoreFailed: t("filters.loadMoreFailed"),
              loading: t("filters.loading"),
            }}
            locale={locale}
            search={search}
            sort={sort}
            startPage={result.page}
            total={total}
          >
            {/* Server-rendered: in the HTML before any script runs. */}
            {initial.map((job) => (
              <JobCard job={job} key={job.id} labels={labels} />
            ))}
          </JobsLoadMore>
        ) : (
          <EmptyFeed
            clearHref={clearFiltersHref(searchParams)}
            copy={
              filtered
                ? {
                    body: t("emptyState.description"),
                    clear: t("emptyState.clearFilters"),
                    interest: t("emptyState.interestCta"),
                    title: t("emptyState.title"),
                  }
                : {
                    body: t("emptyState.seasonalBody"),
                    clear: t("emptyState.clearFilters"),
                    interest: t("emptyState.interestCta"),
                    title: t("emptyState.seasonalTitle"),
                  }
            }
            filtered={filtered}
          />
        )}
      </Section>
    </>
  );
}
