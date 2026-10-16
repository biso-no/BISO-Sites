import type { CampusData, Events, News } from "@repo/api/types/appwrite";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { UNIT_CATEGORY_MESSAGE_KEYS } from "@repo/shared/utils/unit-categories";
import { unitDisplayName } from "@repo/shared/utils/unit-names";
import { Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CardGrid } from "@/components/ui/card-grid";
import { DateBlock } from "@/components/ui/date-block";
import { OptionalLink } from "@/components/ui/optional-link";
import { PageHeader } from "@/components/ui/page-header";
import { PersonCard } from "@/components/ui/person-card";
import { Pill } from "@/components/ui/pill";
import { RowThumb } from "@/components/ui/row-thumb";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatRow } from "@/components/ui/stat-row";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import { UnitCard } from "@/components/units/v2/unit-card";
import { NATIONAL_CAMPUS_ID } from "@/lib/campus-scope";
import { getPrimaryTranslation } from "@/lib/content-translation";
import type { BoardSection } from "@/lib/data/campus-leadership";
import type { PublicUnit } from "@/lib/data/units";
import { formatArticleDate } from "@/lib/news-article";

/**
 * A campus, built from the data that exists.
 *
 * **PLACEHOLDER-009.** `01-design-spec.md` §4.4 designs this page around
 * `CampusMetadata` (tagline, description, highlights, focus areas) and
 * `CampusData` (benefits, partnership offer), describing them as content that
 * "already exists and is barely used". Both tables were **empty** when the
 * page was built. None of that is invented here: every editorial block is
 * rendered only when it arrives, so the page fills in by itself the day the
 * rows are written; until then it is built from what is real — who to
 * contact, what is on, who runs the campus and which units are here.
 *
 * The counts are real too, which is the other half of PLACEHOLDER-004: the
 * reference's "25+ societies · 120+ events/yr · 3000+ students" have no source,
 * but units, upcoming events and open positions *on this campus* are all
 * countable, so those three are shown and the invented ones are not.
 *
 * What the retired `/campus` tabs carried lives here as sections: the
 * management board ("Ledelsen"), "For students" (the campus's benefits and its
 * units) and "For businesses" (its partnership offer). The campus is the route
 * — there is no campus picker on the page.
 */
export interface CampusLandingProps {
  /** This campus's `campus_data` row, when one exists. */
  campusData: CampusData | null;
  description: string | null;
  email: string | null;
  /** Campus-wide upcoming total, not `events.length`; null when unknown. */
  eventCount: number | null;
  events: Events[];
  focusAreas: string[];
  highlights: string[];
  id: string;
  /** Campus-wide open total, not `jobs.length`; null when unknown. */
  jobCount: number | null;
  jobs: RecruitmentVacancy[];
  /** Microsoft 365 leadership groups; empty when the board is unreachable. */
  leadership: BoardSection[];
  locale: "en" | "no";
  name: string;
  news: News[];
  slug: string;
  /** Public units on this campus. */
  units: PublicUnit[];
}

/** How many unit cards the landing shows before "all units here". */
const UNITS_PREVIEW = 8;

/** Campuses with a photograph in `public/images/campus`. */
const CAMPUS_PHOTOS = new Set(["oslo", "bergen", "trondheim", "stavanger"]);

type BenefitGroup =
  | "studentBenefits"
  | "careerAdvantages"
  | "socialNetwork"
  | "safety";

const BENEFIT_GROUPS: BenefitGroup[] = [
  "studentBenefits",
  "careerAdvantages",
  "socialNetwork",
  "safety",
];

const ROW_CLASS =
  "flex items-start gap-4 rounded-biso-md border border-edge p-4 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** A `campus_data` list in the visitor's language, the other as fallback. */
function localizedList(
  data: CampusData | null,
  key: BenefitGroup | "businessBenefits",
  locale: "en" | "no"
): string[] {
  if (!data) {
    return [];
  }
  const english = data[`${key}_en`];
  const norwegian = data[`${key}_nb`];
  const preferred = locale === "en" ? english : norwegian;
  const secondary = locale === "en" ? norwegian : english;
  const list = preferred?.length ? preferred : (secondary ?? []);
  return list.map((item) => item.trim()).filter(Boolean);
}

export async function CampusLanding({
  campusData,
  description,
  email,
  eventCount,
  events,
  focusAreas,
  highlights,
  id,
  jobCount,
  jobs,
  leadership,
  locale,
  name,
  news,
  slug,
  units,
}: CampusLandingProps) {
  const t = await getTranslations("campus");

  // Only counts with a source behind them, and only *totals* — `events` and
  // `jobs` arrive capped for the preview blocks below, so their lengths would
  // report "4 events" for a campus with forty. A total that could not be read
  // is dropped rather than shown as zero.
  const stats = [
    { label: t("stats.units"), count: units.length },
    { label: t("stats.events"), count: eventCount ?? 0 },
    { label: t("stats.jobs"), count: jobCount ?? 0 },
  ]
    .filter((stat) => stat.count > 0)
    .map((stat) => ({ label: stat.label, value: String(stat.count) }));

  const benefitGroups = BENEFIT_GROUPS.map((key) => ({
    key,
    items: localizedList(campusData, key, locale),
  })).filter((group) => group.items.length > 0);
  const businessBenefits = localizedList(
    campusData,
    "businessBenefits",
    locale
  );

  return (
    <>
      <LandingHeader
        description={description}
        email={email}
        highlights={highlights}
        name={name}
        slug={slug}
      />

      {stats.length > 0 ? (
        <Section rhythm="none" tone="paper">
          <div className="border-edge border-b py-8">
            <StatRow stats={stats} />
          </div>
        </Section>
      ) : null}

      <FeedsSection events={events} locale={locale} news={news} slug={slug} />

      {jobs.length > 0 ? <JobsSection jobs={jobs} slug={slug} /> : null}

      {focusAreas.length > 0 ? (
        <Section className="border-edge border-t" tone="paper">
          <SectionHeading>{t("focusAreas")}</SectionHeading>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {focusAreas.map((area) => (
              <li
                className="type-body rounded-biso-md border border-edge p-4 text-ink"
                key={area}
              >
                {area}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Who runs this campus — the old "Management" tab, read live from
          Microsoft 365. Placed after the feeds and before the units: the
          people are the answer to "who do I talk to", which belongs near the
          contact affordances. */}
      {leadership.length > 0 ? (
        <LeadershipSection
          campusName={name}
          isNational={id === NATIONAL_CAMPUS_ID}
          leadership={leadership}
        />
      ) : null}

      {benefitGroups.length > 0 || units.length > 0 ? (
        <ForStudentsSection
          benefitGroups={benefitGroups}
          slug={slug}
          units={units}
        />
      ) : null}

      {businessBenefits.length > 0 ? (
        <ForBusinessesSection benefits={businessBenefits} campusName={name} />
      ) : null}
    </>
  );
}

async function LandingHeader({
  description,
  email,
  highlights,
  name,
  slug,
}: {
  description: string | null;
  email: string | null;
  highlights: string[];
  name: string;
  slug: string;
}) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("campus"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  return (
    <PageHeader
      actions={
        <>
          <Link className={statusPanelPrimaryAction} href="/membership">
            {t("actions.join")}
          </Link>
          {email ? (
            <a
              className="inline-flex items-center gap-2 self-center text-current underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={`mailto:${email}`}
            >
              <Mail aria-hidden="true" className="size-4" />
              <span className="type-label">{email}</span>
            </a>
          ) : null}
        </>
      }
      breadcrumbs={[
        { label: tCommon("breadcrumbs.home"), href: "/" },
        { label: tNav("campus"), href: "/campus" },
        { label: name },
      ]}
      eyebrow={tNav("campus")}
      lede={description ?? undefined}
      media={
        // The campus's own photograph — the chevron frame as a container for
        // identity (spec §7.4). National is not a place and has none.
        CAMPUS_PHOTOS.has(slug) ? (
          <Image
            alt=""
            fill
            priority
            sizes="22rem"
            src={`/images/campus/${slug}.png`}
          />
        ) : undefined
      }
      // An empty array is truthy, and `PageHeader` would render an empty flex
      // row that still carries its margin — the same trap the job card hit in
      // RD-019. `undefined` renders nothing at all.
      meta={
        highlights.length > 0
          ? highlights.map((highlight) => (
              <Pill key={highlight} tone="accent">
                {highlight}
              </Pill>
            ))
          : undefined
      }
      title={`BISO ${name}`}
    />
  );
}

function FeedBlock({
  children,
  href,
  linkLabel,
  title,
}: {
  children: ReactNode;
  href: string;
  linkLabel: string;
  title: string;
}) {
  return (
    <div className="min-w-0">
      <SectionHeading seeAllHref={href} seeAllLabel={linkLabel}>
        {title}
      </SectionHeading>
      {children}
    </div>
  );
}

/** Upcoming events and the latest news, side by side, scoped to the campus. */
async function FeedsSection({
  events,
  locale,
  news,
  slug,
}: {
  events: Events[];
  locale: "en" | "no";
  news: News[];
  slug: string;
}) {
  const [t, tNav] = await Promise.all([
    getTranslations("campus"),
    getTranslations("common.navigation"),
  ]);
  const intlLocale = locale === "no" ? "nb-NO" : "en-GB";

  return (
    <Section tone="paper">
      <div className="grid gap-12 lg:grid-cols-2">
        <FeedBlock
          href={`/events?campus=${slug}`}
          linkLabel={t("seeAll.events")}
          title={tNav("events")}
        >
          {events.length > 0 ? (
            <ul className="space-y-3">
              {events.map((event) => (
                <li key={event.$id}>
                  <OptionalLink
                    className={ROW_CLASS}
                    href={event.slug ? `/events/${event.slug}` : null}
                  >
                    {event.start_date ? (
                      <DateBlock date={event.start_date} locale={intlLocale} />
                    ) : null}
                    <span className="min-w-0">
                      <span className="type-heading-card block text-ink">
                        {getPrimaryTranslation(event, locale)?.title}
                      </span>
                      {event.location ? (
                        <span className="type-body-sm mt-1 block text-ink-muted">
                          {event.location}
                        </span>
                      ) : null}
                    </span>
                    <RowThumb className="ml-auto" src={event.image} />
                  </OptionalLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-body text-ink-muted">{t("empty.events")}</p>
          )}
        </FeedBlock>

        <FeedBlock
          href={`/news?campus=${slug}`}
          linkLabel={t("seeAll.news")}
          title={tNav("news")}
        >
          {news.length > 0 ? (
            <ul className="space-y-3">
              {news.map((article) => (
                <li key={article.$id}>
                  <OptionalLink
                    className={ROW_CLASS}
                    href={article.slug ? `/news/${article.slug}` : null}
                  >
                    <span className="min-w-0">
                      <span className="type-data block text-ink-muted">
                        {formatArticleDate(article.$createdAt, locale, "short")}
                      </span>
                      <span className="type-heading-card mt-1 block text-ink">
                        {getPrimaryTranslation(article, locale)?.title}
                      </span>
                    </span>
                    <RowThumb className="ml-auto" src={article.image} />
                  </OptionalLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-body text-ink-muted">{t("empty.news")}</p>
          )}
        </FeedBlock>
      </div>
    </Section>
  );
}

async function JobsSection({
  jobs,
  slug,
}: {
  jobs: RecruitmentVacancy[];
  slug: string;
}) {
  const [t, tNav] = await Promise.all([
    getTranslations("campus"),
    getTranslations("common.navigation"),
  ]);

  return (
    <Section className="border-edge border-t" tone="paper">
      <SectionHeading
        seeAllHref={`/jobs?campus=${slug}`}
        seeAllLabel={t("seeAll.jobs")}
      >
        {tNav("links.jobs")}
      </SectionHeading>
      <CardGrid>
        {jobs.map((job) => (
          <li key={job.$id}>
            <Link
              className="flex h-full flex-col rounded-biso-md border border-edge p-5 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={`/jobs/${job.slug || job.$id}`}
            >
              <span className="type-heading-card text-ink">
                {job.translations[0]?.title}
              </span>
              {job.department?.Name ? (
                <span className="type-body-sm mt-2 text-ink-muted">
                  {/* The display name, never the campus-prefixed
                      accounting `Name`. */}
                  {unitDisplayName(job.department.Name)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </CardGrid>
    </Section>
  );
}

async function LeadershipSection({
  campusName,
  isNational,
  leadership,
}: {
  campusName: string;
  isNational: boolean;
  leadership: BoardSection[];
}) {
  const [t, tLabels] = await Promise.all([
    getTranslations("campus"),
    getTranslations("common.labels"),
  ]);

  return (
    <Section className="border-edge border-t" id="team" tone="paper">
      <SectionHeading className="mb-2">{t("leadership.title")}</SectionHeading>
      <p className="type-body-sm mb-6 max-w-(--measure) text-ink-muted">
        {isNational ? t("leadership.ledeNational") : t("leadership.lede")}
      </p>
      {leadership.map((group) => (
        <div className="mb-8 last:mb-0" key={group.key ?? "board"}>
          {group.key ? (
            <h3 className="type-heading-card mb-4 text-ink">
              {t(`leadership.groups.${group.key}`)}
            </h3>
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {group.members.map((member) => (
              <li key={`${group.key ?? "board"}-${member.name}`}>
                <PersonCard
                  campus={campusName}
                  className="h-full"
                  email={member.email}
                  emailLabel={tLabels("emailPerson", { name: member.name })}
                  imageUrl={member.imageUrl}
                  name={member.name}
                  phone={member.phone}
                  phoneLabel={tLabels("callPerson", { name: member.name })}
                  position={member.position}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}

/** The old "For students" tab: the campus's benefits, then its units. */
async function ForStudentsSection({
  benefitGroups,
  slug,
  units,
}: {
  benefitGroups: { items: string[]; key: BenefitGroup }[];
  slug: string;
  units: PublicUnit[];
}) {
  const [t, tUnits, tCategory] = await Promise.all([
    getTranslations("campus"),
    getTranslations("units"),
    // Unit categories are named once, in the jobs filter bundle.
    getTranslations("jobs"),
  ]);
  const unitPreview = units.slice(0, UNITS_PREVIEW);

  return (
    <Section className="border-edge border-t" id="students" tone="paper">
      <SectionHeading className="mb-2">{t("forStudents.title")}</SectionHeading>
      <p className="type-body-sm mb-8 max-w-(--measure) text-ink-muted">
        {t("forStudents.lede")}
      </p>

      {benefitGroups.length > 0 ? (
        <ul className="mb-12 grid gap-4 last:mb-0 sm:grid-cols-2">
          {benefitGroups.map((group) => (
            <li
              className="rounded-biso-md border border-edge p-6"
              key={group.key}
            >
              <h3 className="type-heading-card text-ink">
                {t(`forStudents.groups.${group.key}.title`)}
              </h3>
              <p className="type-body-sm mt-1 text-ink-muted">
                {t(`forStudents.groups.${group.key}.description`)}
              </p>
              <ul className="mt-4 space-y-2">
                {group.items.map((item) => (
                  <li
                    className="type-body-sm border-ink-accent border-l-2 pl-3 text-ink"
                    key={item}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}

      {unitPreview.length > 0 ? (
        <div>
          <SectionHeading
            as="h3"
            className="mb-2"
            seeAllHref={`/units?campus=${slug}`}
            seeAllLabel={t("seeAll.units")}
          >
            {t("units.title")}
          </SectionHeading>
          <p className="type-body-sm mb-6 max-w-(--measure) text-ink-muted">
            {t("units.lede", { count: units.length })}
          </p>
          <CardGrid columns={4}>
            {unitPreview.map((unit) => (
              <li className="min-w-0" key={unit.id}>
                <UnitCard
                  headingLevel="h4"
                  labels={{
                    category: unit.category
                      ? tCategory(
                          `filters.${UNIT_CATEGORY_MESSAGE_KEYS[unit.category]}`
                        )
                      : null,
                    noSummary: tUnits("card.noSummary"),
                  }}
                  showCampus={false}
                  unit={unit}
                />
              </li>
            ))}
          </CardGrid>
        </div>
      ) : null}
    </Section>
  );
}

/** The old "For businesses" tab: the campus's partnership offer. */
async function ForBusinessesSection({
  benefits,
  campusName,
}: {
  benefits: string[];
  campusName: string;
}) {
  const t = await getTranslations("campus");

  return (
    <Section className="border-edge border-t" id="partners" tone="paper">
      <SectionHeading className="mb-2">
        {t("forBusinesses.title")}
      </SectionHeading>
      <p className="type-body-sm mb-8 max-w-(--measure) text-ink-muted">
        {t("forBusinesses.lede", { campus: campusName })}
      </p>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <h3 className="type-heading-card mb-4 text-ink">
            {t("forBusinesses.benefitsTitle")}
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <li
                className="type-body-sm border-ink-accent border-l-2 pl-3 text-ink"
                key={benefit}
              >
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <div className="self-start rounded-biso-md border border-edge p-6">
          <h3 className="type-heading-card text-ink">
            {t("forBusinesses.ctaTitle")}
          </h3>
          <p className="type-body-sm mt-2 text-ink-muted">
            {t("forBusinesses.ctaBody")}
          </p>
          <Link
            className={`${statusPanelSecondaryAction} mt-5`}
            href="/contact"
          >
            {t("forBusinesses.cta")}
          </Link>
        </div>
      </div>
    </Section>
  );
}
