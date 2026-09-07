import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import {
  parseUnitCategory,
  UNIT_CATEGORIES,
  UNIT_CATEGORY_MESSAGE_KEYS,
} from "@repo/shared/utils/unit-categories";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { FeedSearch } from "@/components/ui/feed-search";
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { CAMPUS_SLUGS, campusIdToSlug } from "@/lib/campus-scope";

/**
 * The jobs listing, rebuilt as a Server Component with link-based filters.
 *
 * The current list holds its filters in `useState` and mirrors them to the URL
 * with `router.replace`. That makes a filtered view shareable but **not
 * navigable**: `replace` writes no history entry, so the back button skips
 * straight past every filter change the visitor made. Links fix that, and they
 * also mean the list renders without waiting for hydration.
 *
 * `?campus=` (RD-016) composes with `?type=` here because `<FilterChips>`
 * rebuilds each href from the current parameters and changes only its own.
 *
 * **PLACEHOLDER-002.** The reference design shows a workload badge on each card
 * — "20%", "15%". `Jobs` has no such column, so no badge is rendered. Adding
 * `workload_pct` to the table is the smallest fix.
 */
export interface JobsV2Props {
  campusId: string | null;
  jobs: RecruitmentVacancy[];
  locale: string;
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * The v1 sort orders, kept because shared `?sort=` URLs still carry them.
 * `localizeVacancy` sorts the requested locale first, so `translations[0]` is
 * the displayed title — the same one the card renders.
 */
function sortJobs(
  jobs: RecruitmentVacancy[],
  sort: string
): RecruitmentVacancy[] {
  if (sort === "deadline") {
    return [...jobs].sort((a, b) => {
      const da = a.application_deadline
        ? new Date(a.application_deadline).getTime()
        : Number.POSITIVE_INFINITY;
      const db = b.application_deadline
        ? new Date(b.application_deadline).getTime()
        : Number.POSITIVE_INFINITY;
      return da - db;
    });
  }
  if (sort === "alpha") {
    return [...jobs].sort((a, b) =>
      (a.translations[0]?.title ?? "").localeCompare(
        b.translations[0]?.title ?? ""
      )
    );
  }
  // "newest" is the server's own order; an unrecognised value falls here too
  // rather than shuffling the list into something the URL did not ask for.
  return jobs;
}

function JobCard({
  job,
  locale,
  paidLabel,
  deadlineLabel,
}: {
  deadlineLabel: string;
  job: RecruitmentVacancy;
  locale: string;
  paidLabel: string;
}) {
  // `localizeVacancy` (in `listJobs`) already sorts the requested locale to the
  // front, so index 0 is the right translation — same convention as `job-card`.
  const translation = job.translations[0];
  const deadline = job.application_deadline
    ? new Date(job.application_deadline).toLocaleDateString(
        locale === "no" ? "nb-NO" : "en-GB"
      )
    : null;
  const hasPills = Boolean(job.metadata.employment_type || job.metadata.paid);

  return (
    <li>
      <Link
        className="flex h-full flex-col rounded-biso-md border border-edge p-5 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        href={`/jobs/${job.slug || job.$id}`}
      >
        {/* Only render the row when there is a pill for it — an empty flex
            row still carries its bottom margin. */}
        {hasPills ? (
          <span className="mb-3 flex flex-wrap gap-2">
            {job.metadata.employment_type ? (
              <Pill tone="accent" uppercase>
                {job.metadata.employment_type}
              </Pill>
            ) : null}
            {job.metadata.paid ? <Pill tone="success">{paidLabel}</Pill> : null}
          </span>
        ) : null}

        <span className="type-heading-card text-ink">{translation?.title}</span>

        {job.department?.Name ? (
          <span className="type-body-sm mt-2 text-ink-muted">
            {job.department.Name}
          </span>
        ) : null}

        {deadline ? (
          <span className="type-data mt-auto pt-4 text-ink-muted">
            {deadlineLabel} {deadline}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export async function JobsV2({
  jobs,
  locale,
  searchParams,
  campusId,
}: JobsV2Props) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("jobs"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const activeType =
    typeof searchParams.type === "string" ? searchParams.type : "all";

  // The organisational category of the unit that owns the vacancy — societies,
  // projects, academic associations, staff functions, national. Distinct from
  // `?type=`, which is the employment type. `departments.type` is free text and
  // still null on most units, so the options are derived from the loaded jobs
  // and `<FilterChips>` drops the row entirely while none of them carry one.
  const activeCategory =
    parseUnitCategory(searchParams.category) ?? ("all" as const);
  const presentCategories = new Set(
    jobs.map((job) => parseUnitCategory(job.department?.type)).filter(Boolean)
  );
  const categoryOptions: FilterOption[] = [
    { value: "all", label: t("filters.all") },
    ...UNIT_CATEGORIES.filter((value) => presentCategories.has(value)).map(
      (value) => ({
        value,
        label: t(`filters.${UNIT_CATEGORY_MESSAGE_KEYS[value]}`),
        count: jobs.filter(
          (job) => parseUnitCategory(job.department?.type) === value
        ).length,
      })
    ),
  ];

  // Employment types come from the data, not a hardcoded list — a value that
  // stops appearing stops being offered.
  const typeOptions: FilterOption[] = [
    { value: "all", label: t("filters.all") },
    ...[
      ...new Set(
        jobs.map((job) => job.metadata.employment_type).filter(Boolean)
      ),
    ].map((type) => ({
      value: String(type),
      label: String(type),
      count: jobs.filter((job) => job.metadata.employment_type === type).length,
    })),
  ];

  const campusOptions: FilterOption[] = [
    { value: "all", label: tNav("allCampuses") },
    ...CAMPUS_SLUGS.map((slug) => ({
      value: slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
    })),
  ];

  // `?paid=true` and `?sort=` are pre-redesign URL contracts: the v1 client
  // filtered and sorted on them, and shared links still carry them. The v2
  // filter row does not offer a sort control — the v1 one used hardcoded
  // English labels and no localized copy for it exists — so `sort` is honoured
  // for inbound links without being newly settable. `paid` gets a chip, because
  // `filters.paidOnly` is already translated in both locales.
  // A search must not silently drop the filters already applied.
  const searchHidden: Record<string, string> = {};
  for (const key of ["campus", "type", "category", "paid", "sort"]) {
    const value = searchParams[key];
    if (typeof value === "string") {
      searchHidden[key] = value;
    }
  }

  const paidOnly = searchParams.paid === "true";
  const activeSort =
    typeof searchParams.sort === "string" ? searchParams.sort : "newest";

  // Offering a filter that can only empty the list is not a choice; FilterChips
  // already drops itself below two options, so an empty array hides the row.
  const paidCount = jobs.filter((job) => job.metadata.paid === true).length;
  const paidOptions: FilterOption[] =
    paidCount > 0
      ? [
          { value: "all", label: t("filters.all") },
          { value: "true", label: t("filters.paidOnly"), count: paidCount },
        ]
      : [];

  const filtered = jobs.filter((job) => {
    if (activeType !== "all" && job.metadata.employment_type !== activeType) {
      return false;
    }
    // An uncategorised unit only drops out once a category is actively picked.
    if (
      activeCategory !== "all" &&
      parseUnitCategory(job.department?.type) !== activeCategory
    ) {
      return false;
    }
    return !paidOnly || job.metadata.paid === true;
  });

  const visible = sortJobs(filtered, activeSort);

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
          {/* `?q=` filtered server-side all along; the rewrite dropped the only
              control that could set it, so the feature was reachable by URL
              only. */}
          <FeedSearch
            action="/jobs"
            defaultValue={
              typeof searchParams.q === "string" ? searchParams.q : ""
            }
            hidden={searchHidden}
            label={t("filters.searchLabel")}
            name="q"
            placeholder={t("filters.searchPlaceholder")}
            submitLabel={t("filters.searchSubmit")}
            surface="jobs"
          />
          <FilterChips
            active={activeType}
            basePath="/jobs"
            label={t("filters.employmentTypeLabel")}
            options={typeOptions}
            param="type"
            searchParams={searchParams}
          />
          <FilterChips
            active={activeCategory}
            basePath="/jobs"
            label={t("filters.categoryLabel")}
            options={categoryOptions}
            param="category"
            searchParams={searchParams}
          />
          <FilterChips
            active={campusIdToSlug(campusId) ?? "all"}
            basePath="/jobs"
            label={t("filters.campusLabel")}
            options={campusOptions}
            param="campus"
            searchParams={searchParams}
          />
          <FilterChips
            active={paidOnly ? "true" : "all"}
            basePath="/jobs"
            label={t("filters.paidOnly")}
            options={paidOptions}
            param="paid"
            searchParams={searchParams}
          />
        </div>

        <p className="type-body-sm mb-6 text-ink-muted">
          {t("results.count", { count: visible.length })}
        </p>

        {visible.length > 0 ? (
          <CardGrid>
            {visible.map((job) => (
              <JobCard
                deadlineLabel={t("card.deadline")}
                job={job}
                key={job.$id}
                locale={locale}
                paidLabel={t("card.paid")}
              />
            ))}
          </CardGrid>
        ) : (
          <p className="type-body text-ink-muted">{t("emptyState.title")}</p>
        )}
      </Section>
    </>
  );
}
