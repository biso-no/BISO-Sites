import type { Locale } from "@repo/i18n/config";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { UNIT_CATEGORY_MESSAGE_KEYS } from "@repo/shared/utils/unit-categories";
import { getTranslations } from "next-intl/server";
import {
  JobCard,
  type JobCardLabels,
  toJobCardModel,
} from "@/components/jobs/v2/job-card";
import { CardGrid } from "@/components/ui/card-grid";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { UnitCard } from "@/components/units/v2/unit-card";
import type { PublicUnit } from "@/lib/data/units";

/**
 * The parts of the campus overview that moved to the front page with batch G:
 * open roles and the unit grid, both already campus-scoped by the page. Each
 * section is omitted when its source is empty.
 */

/** Two rows of four; the whole directory is one link away. */
const UNIT_PREVIEW_COUNT = 8;

export interface OpenRolesProps {
  jobs: RecruitmentVacancy[];
  locale: Locale;
  /** `/jobs`, scoped like the page. */
  seeAllHref: string;
}

/** The first few open roles, as the `/jobs` cards render them. */
export async function OpenRoles({ jobs, locale, seeAllHref }: OpenRolesProps) {
  if (jobs.length === 0) {
    return null;
  }
  const [t, tJobs, tNav] = await Promise.all([
    getTranslations("home"),
    getTranslations("jobs"),
    getTranslations("common.navigation"),
  ]);
  const labels: JobCardLabels = {
    deadline: tJobs("card.deadline"),
    membersOnly: tJobs("card.membersOnly"),
    paid: tJobs("card.paid"),
  };

  return (
    <Section className="border-edge border-t" id="jobs" tone="paper">
      <SectionHeading seeAllHref={seeAllHref} seeAllLabel={t("jobs.cta")}>
        {tNav("links.jobs")}
      </SectionHeading>
      {/* The `/jobs` card itself, so a role reads the same on the front page
          as in the listing — members-only pill and Oslo-time deadline
          included. */}
      <CardGrid>
        {jobs.map((job) => (
          <JobCard
            job={toJobCardModel(job, locale)}
            key={job.$id}
            labels={labels}
          />
        ))}
      </CardGrid>
    </Section>
  );
}

export interface CampusUnitsProps {
  /** `/units`, scoped like the page. */
  seeAllHref: string;
  /** Name each unit's campus — on when the grid spans every campus. */
  showCampus: boolean;
  units: PublicUnit[];
}

/** The campus's units as the shared unit cards, capped to a preview. */
export async function CampusUnits({
  seeAllHref,
  showCampus,
  units,
}: CampusUnitsProps) {
  if (units.length === 0) {
    return null;
  }
  const [t, tJobs, tUnits] = await Promise.all([
    getTranslations("home"),
    // Category labels live in the shared `jobs.filters` bundle so units and
    // jobs name the same categories identically.
    getTranslations("jobs"),
    getTranslations("units"),
  ]);
  const noSummary = tUnits("card.noSummary");

  return (
    <Section className="border-edge border-t" id="units" tone="paper">
      <SectionHeading seeAllHref={seeAllHref} seeAllLabel={t("units.cta")}>
        {t("units.title")}
      </SectionHeading>
      <p className="type-body-sm mb-6 max-w-(--measure) text-ink-muted">
        {t("units.description", { count: units.length })}
      </p>
      <CardGrid columns={4}>
        {units.slice(0, UNIT_PREVIEW_COUNT).map((unit) => (
          <li key={unit.id}>
            <UnitCard
              labels={{
                category: unit.category
                  ? tJobs(
                      `filters.${UNIT_CATEGORY_MESSAGE_KEYS[unit.category]}`
                    )
                  : null,
                noSummary,
              }}
              showCampus={showCampus}
              unit={unit}
            />
          </li>
        ))}
      </CardGrid>
    </Section>
  );
}
