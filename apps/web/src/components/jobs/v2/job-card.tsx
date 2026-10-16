import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { unitDisplayName } from "@repo/shared/utils/unit-names";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";

/**
 * One vacancy in the `/jobs` grid.
 *
 * Shared by the server-rendered first page and the client "load more" island
 * (`jobs-load-more.tsx`), so both render identical markup. That is why this
 * module is hook-free and imports nothing server-only, and why the labels
 * arrive already translated.
 *
 * The card takes a `JobCardModel` rather than the vacancy itself: the island
 * receives the server's first page as props, and twelve display-ready rows are
 * a fraction of twelve vacancies with their full descriptions.
 *
 * **PLACEHOLDER-002.** The reference design shows a workload badge on each card.
 * `Jobs` has no such column, so no badge is rendered.
 */

/**
 * Vacancy dates are Norwegian calendar dates. Pinning the zone keeps the
 * server's render (in the container's zone) and the browser's (in the
 * visitor's) on the same day — a deadline at midnight Oslo time is the
 * previous day in UTC.
 */
export const JOB_TIME_ZONE = "Europe/Oslo";

export function formatJobDate(
  value: string | null | undefined,
  locale: string
): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(locale === "no" ? "nb-NO" : "en-GB", {
    timeZone: JOB_TIME_ZONE,
  });
}

export interface JobCardModel {
  /** Formatted for the visitor's locale, or null for a rolling deadline. */
  deadline: string | null;
  employmentType: string | null;
  href: string;
  id: string;
  membersOnly: boolean;
  paid: boolean;
  /** "Unit · Campus", whichever parts the vacancy has. */
  place: string | null;
  title: string;
}

export interface JobCardLabels {
  /** Precedes the deadline, e.g. "Apply by". */
  deadline: string;
  membersOnly: string;
  paid: string;
}

export function toJobCardModel(
  job: RecruitmentVacancy,
  locale: string
): JobCardModel {
  // `localizeVacancy` (in `listJobs`) sorts the requested locale to the front
  // and fills its blanks from the other locale, so index 0 is the title to
  // show.
  const title = job.translations[0]?.title?.trim() || job.slug;
  // The accounting name carries a campus prefix ("OSL Fadderullan"). The
  // campus is shown beside it, so the card uses the public name.
  const unit = job.department?.Name
    ? unitDisplayName(job.department.Name)
    : null;
  const place = [unit, job.campus?.name].filter(Boolean).join(" · ");

  return {
    deadline: formatJobDate(job.application_deadline, locale),
    employmentType: job.metadata.employment_type ?? null,
    href: `/jobs/${job.slug || job.$id}`,
    id: job.$id,
    membersOnly: job.metadata.audience === "members",
    paid: job.metadata.paid === true,
    place: place || null,
    title,
  };
}

export function JobCard({
  job,
  labels,
}: {
  job: JobCardModel;
  labels: JobCardLabels;
}) {
  const hasPills = Boolean(job.employmentType || job.paid || job.membersOnly);

  return (
    <li>
      <Link
        className="flex h-full flex-col rounded-biso-md border border-edge p-5 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        href={job.href}
      >
        {/* Only render the row when there is a pill for it — an empty flex
            row still carries its bottom margin. */}
        {hasPills ? (
          <span className="mb-3 flex flex-wrap gap-2">
            {job.employmentType ? (
              <Pill tone="accent" uppercase>
                {job.employmentType}
              </Pill>
            ) : null}
            {job.paid ? <Pill tone="success">{labels.paid}</Pill> : null}
            {/* Members-only vacancies are readable by everyone; only applying
                is gated, so the card says so before the visitor opens it. */}
            {job.membersOnly ? (
              <Pill tone="warning">{labels.membersOnly}</Pill>
            ) : null}
          </span>
        ) : null}

        <span className="type-heading-card text-ink">{job.title}</span>

        {job.place ? (
          <span className="type-body-sm mt-2 text-ink-muted">{job.place}</span>
        ) : null}

        {job.deadline ? (
          <span className="type-data mt-auto pt-4 text-ink-muted">
            {labels.deadline} {job.deadline}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
