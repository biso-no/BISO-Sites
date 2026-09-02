import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
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

  const visible =
    activeType === "all"
      ? jobs
      : jobs.filter((job) => job.metadata.employment_type === activeType);

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
          <FilterChips
            active={activeType}
            basePath="/jobs"
            label={t("filters.employmentTypeLabel")}
            options={typeOptions}
            param="type"
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
