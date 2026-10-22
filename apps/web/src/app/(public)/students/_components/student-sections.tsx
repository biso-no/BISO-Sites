import type { Events } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { BENEFIT_SECTIONS } from "@repo/shared/utils/benefit-catalog";
import {
  benefitsForCampus,
  type PublicBenefit,
} from "@repo/shared/utils/benefit-public";
import { UNIT_CATEGORY_MESSAGE_KEYS } from "@repo/shared/utils/unit-categories";
import { unitDisplayName } from "@repo/shared/utils/unit-names";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BenefitSummaryCard } from "@/components/benefits/v2/benefit-summary-card";
import { MembersOnlyBadge } from "@/components/events/members-only";
import { CardGrid } from "@/components/ui/card-grid";
import { DateBlock } from "@/components/ui/date-block";
import { OptionalLink } from "@/components/ui/optional-link";
import { Pill } from "@/components/ui/pill";
import { RowThumb } from "@/components/ui/row-thumb";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";
import { UnitCard } from "@/components/units/v2/unit-card";
import { localizedPublicBenefitText } from "@/lib/benefit-text";
import { toPlainText } from "@/lib/content-text";
import { getPrimaryTranslation } from "@/lib/content-translation";
import type { PublicUnit } from "@/lib/data/units";
import { getEventHref } from "@/lib/types/event";

/**
 * The sections of `/students`, as Server Components.
 *
 * Main rebuilt the page (#63) — a benefits grid instead of a horizontal
 * scroller that hid two of its cards, wholly clickable job cards, real empty
 * states, campus filtering and per-field translation picking — and limited it
 * to upcoming events (#87). The redesign rewrote it as a server page on its
 * primitives. These are main's sections in the redesign's terms: the data and
 * the empty states are main's, the markup is v2, and nothing here needs the
 * browser.
 */

/** Main's card budget: enough to scan, short of a wall of text. */
const BENEFIT_ITEMS_PER_CARD = 4;

/** One row of member deal cards; the rest are a click away on `/membership`. */
const MEMBER_DEALS = 3;

/** The one-line studio sections, listed after the member deals. */
const LINE_SECTIONS = BENEFIT_SECTIONS.filter((key) => key !== "member");

const ROW =
  "flex items-start gap-4 rounded-biso-md border border-edge p-4 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const CARD_LINK =
  "group flex h-full flex-col rounded-biso-md border border-edge p-5 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const intlLocaleOf = (locale: Locale) => (locale === "en" ? "en-GB" : "nb-NO");

/**
 * Benefits for the campus plus the national ones, the campus's own rows
 * first so national deals never push them out of the slots: a row of member
 * deals, each with its partner and description, then one card per one-line
 * studio section. Omitted entirely while there are none: an empty section
 * would only promise content that has not been written (PLACEHOLDER-009). The
 * full list lives on `/membership`, which the heading links to.
 */
export async function BenefitsSection({
  benefits,
  benefitsHref,
  campusId,
  campusLabel,
  locale,
}: {
  benefits: PublicBenefit[];
  benefitsHref: string;
  campusId: string | null;
  campusLabel: string;
  locale: Locale;
}) {
  const deals = benefitsForCampus(benefits, campusId, ["member"]).slice(
    0,
    MEMBER_DEALS
  );
  const cards = LINE_SECTIONS.map((key) => ({
    key,
    items: benefitsForCampus(benefits, campusId, [key])
      .slice(0, BENEFIT_ITEMS_PER_CARD)
      .map((benefit) => ({
        id: benefit.id,
        title: localizedPublicBenefitText(benefit, locale).title,
      })),
  })).filter((card) => card.items.length > 0);

  if (deals.length === 0 && cards.length === 0) {
    return null;
  }
  const [t, tBenefits] = await Promise.all([
    getTranslations("students"),
    getTranslations("common.benefits"),
  ]);

  return (
    <Section className="border-edge border-t" id="benefits" tone="paper">
      <SectionHeading
        className="mb-2"
        seeAllHref={benefitsHref}
        seeAllLabel={t("benefits.cta")}
      >
        {t("benefits.title")}
      </SectionHeading>
      <p className="type-body-sm mb-6 max-w-(--measure) text-ink-muted">
        {t("benefits.subtitle", { campus: campusLabel })}
      </p>
      {deals.length > 0 ? (
        <div className="mb-8 last:mb-0">
          <h3 className="type-label mb-3 text-ink-accent">
            {t("benefits.labels.member")}
          </h3>
          <CardGrid>
            {deals.map((benefit) => (
              <BenefitSummaryCard
                benefit={benefit}
                formatValidUntil={(date) => tBenefits("validUntil", { date })}
                key={benefit.id}
                locale={locale}
              />
            ))}
          </CardGrid>
        </div>
      ) : null}
      {cards.length > 0 ? (
        <CardGrid>
          {cards.map((card) => (
            <li
              className="min-w-0 rounded-biso-md border border-edge p-6"
              key={card.key}
            >
              <Pill tone="accent" uppercase>
                {t(`benefits.badges.${card.key}`)}
              </Pill>
              <h3 className="type-heading-card mt-3 break-words text-ink">
                {t(`benefits.labels.${card.key}`)}
              </h3>
              <ul className="mt-4 space-y-2">
                {card.items.map((item) => (
                  <li
                    className="type-body-sm border-ink-accent border-l-2 pl-3 text-ink"
                    key={item.id}
                  >
                    {item.title}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </CardGrid>
      ) : null}
    </Section>
  );
}

/** The campus's units beside the funding offer, as on main. */
export async function UnitsAndFundingSection({
  campusLabel,
  showCampus,
  units,
  unitsHref,
}: {
  campusLabel: string;
  /** Name each unit's campus — on when the list spans every campus. */
  showCampus: boolean;
  units: PublicUnit[];
  unitsHref: string;
}) {
  const [t, tUnits, tCategory] = await Promise.all([
    getTranslations("students"),
    getTranslations("units"),
    // Category labels are named once, in the jobs filter bundle.
    getTranslations("jobs"),
  ]);

  return (
    <Section className="border-edge border-t" id="units" tone="paper">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionHeading
            className="mb-2"
            seeAllHref={unitsHref}
            seeAllLabel={t("units.cta")}
          >
            {t("units.title", { campus: campusLabel })}
          </SectionHeading>
          <p className="type-body-sm mb-6 max-w-(--measure) text-ink-muted">
            {t("units.subtitle")}
          </p>
          {units.length > 0 ? (
            <CardGrid columns={2}>
              {units.map((unit) => (
                <li className="min-w-0" key={unit.id}>
                  <UnitCard
                    labels={{
                      category: unit.category
                        ? tCategory(
                            `filters.${UNIT_CATEGORY_MESSAGE_KEYS[unit.category]}`
                          )
                        : null,
                      noSummary: tUnits("card.noSummary"),
                    }}
                    showCampus={showCampus}
                    unit={unit}
                  />
                </li>
              ))}
            </CardGrid>
          ) : (
            <p className="type-body text-ink-muted">{t("units.empty")}</p>
          )}
        </div>

        {/* Economic support, on a navy panel: `data-surface="deep"` flips the
            aliases, so the text and the action keep their contrast without a
            hand-picked white. */}
        <aside
          aria-labelledby="students-funding"
          className="self-start rounded-biso-md bg-surface p-6 text-ink sm:p-8"
          data-surface="deep"
        >
          <h2
            className="type-display-sm break-words text-ink"
            id="students-funding"
          >
            {t("funding.title")}
          </h2>
          <p className="type-body-sm mt-3 text-ink-muted">
            {t("funding.subtitle")}
          </p>
          <p className="type-body-sm mt-3 text-ink-muted">
            {t("funding.body")}
          </p>
          <Link
            className={`${statusPanelPrimaryAction} mt-6`}
            href="/okonomisk-stotte"
          >
            {t("funding.cta")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </aside>
      </div>
    </Section>
  );
}

/** Upcoming events for the campus; the empty state names the campus. */
export async function EventsSection({
  campusLabel,
  events,
  eventsHref,
  locale,
}: {
  campusLabel: string;
  events: Events[];
  eventsHref: string;
  locale: Locale;
}) {
  const t = await getTranslations("students");
  const intlLocale = intlLocaleOf(locale);

  return (
    <Section className="border-edge border-t" id="events" tone="paper">
      <SectionHeading
        className="mb-2"
        seeAllHref={eventsHref}
        seeAllLabel={t("events.cta")}
      >
        {t("events.title", { campus: campusLabel })}
      </SectionHeading>
      <p className="type-body-sm mb-6 max-w-(--measure) text-ink-muted">
        {t("events.subtitle")}
      </p>
      {events.length > 0 ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {events.map((event) => {
            const translation = getPrimaryTranslation(event, locale);
            const excerpt = toPlainText(translation?.description);
            const where = event.location || event.campus?.name || null;
            return (
              <li className="min-w-0" key={event.$id}>
                {/* The detail route resolves by slug; a row without one is
                    shown but not linked. */}
                <OptionalLink className={ROW} href={getEventHref(event)}>
                  {event.start_date ? (
                    <DateBlock date={event.start_date} locale={intlLocale} />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h3 className="type-heading-card break-words text-ink">
                      {translation?.title}
                    </h3>
                    {where ? (
                      <p className="type-body-sm mt-1 text-ink-muted">
                        {where}
                      </p>
                    ) : null}
                    {excerpt ? (
                      <p className="type-body-sm mt-1 line-clamp-2 text-ink-muted">
                        {excerpt}
                      </p>
                    ) : null}
                    {/* `member_only` limits who can join, not who can see. */}
                    {event.member_only ? (
                      <p className="mt-2 flex">
                        <MembersOnlyBadge />
                      </p>
                    ) : null}
                  </div>
                  <RowThumb className="ml-auto" src={event.image} />
                </OptionalLink>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="type-body text-ink-muted">
          {t("events.empty", { campus: campusLabel })}
        </p>
      )}
    </Section>
  );
}

/** Open positions, each card one link — main's #63, in v2 dress. */
export async function JobsSection({
  jobs,
  jobsHref,
  locale,
}: {
  jobs: RecruitmentVacancy[];
  jobsHref: string;
  locale: Locale;
}) {
  const t = await getTranslations("students");
  const deadline = new Intl.DateTimeFormat(intlLocaleOf(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Section className="border-edge border-t" id="jobs" tone="paper">
      <SectionHeading
        className="mb-2"
        seeAllHref={jobsHref}
        seeAllLabel={t("jobs.cta")}
      >
        {t("jobs.title")}
      </SectionHeading>
      <p className="type-body-sm mb-6 max-w-(--measure) text-ink-muted">
        {t("jobs.subtitle")}
      </p>
      {jobs.length > 0 ? (
        <CardGrid>
          {jobs.map((job) => {
            const translation =
              job.translations.find((entry) => entry.title) ?? null;
            const excerpt = toPlainText(translation?.description);
            return (
              <li className="min-w-0" key={job.$id}>
                <Link
                  className={CARD_LINK}
                  href={`/jobs/${job.slug || job.$id}`}
                >
                  <span className="flex">
                    <Pill tone="accent" uppercase>
                      {job.department?.Name
                        ? unitDisplayName(job.department.Name)
                        : t("jobs.unknownDepartment")}
                    </Pill>
                  </span>
                  <h3 className="type-heading-card mt-3 break-words text-ink group-hover:text-ink-accent">
                    {translation?.title}
                  </h3>
                  {excerpt ? (
                    <p className="type-body-sm mt-2 line-clamp-3 text-ink-muted">
                      {excerpt}
                    </p>
                  ) : null}
                  <span className="type-data mt-auto flex flex-wrap justify-between gap-2 border-edge border-t pt-4 text-ink-muted">
                    <span>{job.campus?.name || job.campus_id}</span>
                    <span>
                      {job.application_deadline
                        ? deadline.format(new Date(job.application_deadline))
                        : t("jobs.rolling")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </CardGrid>
      ) : (
        <p className="type-body text-ink-muted">{t("jobs.empty")}</p>
      )}
    </Section>
  );
}
