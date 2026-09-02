import type { Events, News } from "@repo/api/types/appwrite";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { unitCanonicalPath } from "@repo/shared/utils/unit-urls";
import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CardGrid } from "@/components/ui/card-grid";
import { DateBlock } from "@/components/ui/date-block";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatRow } from "@/components/ui/stat-row";
import { getPrimaryTranslation } from "@/lib/content-translation";
import type { CampusUnit } from "@/lib/data/campus-landing";
import { formatArticleDate } from "@/lib/news-article";

/**
 * A campus, built from the data that exists.
 *
 * **PLACEHOLDER-009.** `01-design-spec.md` §4.4 designs this page around
 * `CampusMetadata` (tagline, description, highlights, focus areas) and
 * `CampusData` (team, partners, benefits), describing them as content that
 * "already exists and is barely used". Both tables are **empty — zero rows** —
 * and so is the photo collage's source: `campus` carries a name and an email
 * and nothing else. None of that is invented here. Every editorial field is
 * rendered only when it arrives, so the page fills in by itself the day the
 * rows are written; until then it is built from what is real — who to contact,
 * what is on, and which units are here.
 *
 * The counts are real too, which is the other half of PLACEHOLDER-004: the
 * reference's "25+ societies · 120+ events/yr · 3000+ students" have no source,
 * but units, published events and open positions *on this campus* are all
 * countable, so those three are shown and the invented ones are not.
 */
export interface CampusLandingProps {
  description: string | null;
  email: string | null;
  events: Events[];
  focusAreas: string[];
  highlights: string[];
  jobs: RecruitmentVacancy[];
  locale: "en" | "no";
  name: string;
  news: News[];
  slug: string;
  units: CampusUnit[];
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
    <div>
      <SectionHeading as="h3" seeAllHref={href} seeAllLabel={linkLabel}>
        {title}
      </SectionHeading>
      {children}
    </div>
  );
}

function rowClass(): string {
  return "flex items-start gap-4 rounded-biso-md border border-edge p-4 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
}

export async function CampusLanding({
  description,
  email,
  events,
  focusAreas,
  highlights,
  jobs,
  locale,
  name,
  news,
  slug,
  units,
}: CampusLandingProps) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("campus"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const intlLocale = locale === "no" ? "nb-NO" : "en-GB";

  // Only counts with a source behind them. `units` is this campus's active
  // departments, `events` and `jobs` are what is published and open here.
  const stats = [
    { label: t("stats.units"), count: units.length },
    { label: t("stats.events"), count: events.length },
    { label: t("stats.jobs"), count: jobs.length },
  ]
    .filter((stat) => stat.count > 0)
    .map((stat) => ({ label: stat.label, value: String(stat.count) }));

  return (
    <>
      <PageHeader
        actions={
          email ? (
            <a
              className="inline-flex items-center gap-2 text-current underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={`mailto:${email}`}
            >
              <Mail aria-hidden="true" className="h-4 w-4" />
              <span className="type-label">{email}</span>
            </a>
          ) : null
        }
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("campus"), href: "/campus" },
          { label: name },
        ]}
        eyebrow={tNav("campus")}
        lede={description ?? undefined}
        // An empty array is truthy, and `PageHeader` would render an empty
        // flex row that still carries its margin — the same trap the job card
        // hit in RD-019. `undefined` renders nothing at all.
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

      {stats.length > 0 ? (
        <Section rhythm="none" tone="paper">
          <div className="border-edge border-b py-8">
            <StatRow stats={stats} />
          </div>
        </Section>
      ) : null}

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
                    <Link className={rowClass()} href={`/events/${event.slug}`}>
                      {event.start_date ? (
                        <DateBlock
                          date={event.start_date}
                          locale={intlLocale}
                        />
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
                    </Link>
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
                    <Link className={rowClass()} href={`/news/${article.slug}`}>
                      <span className="min-w-0">
                        <span className="type-data block text-ink-muted">
                          {formatArticleDate(
                            article.$createdAt,
                            locale,
                            "short"
                          )}
                        </span>
                        <span className="type-heading-card mt-1 block text-ink">
                          {getPrimaryTranslation(article, locale)?.title}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="type-body text-ink-muted">{t("empty.news")}</p>
            )}
          </FeedBlock>
        </div>
      </Section>

      {jobs.length > 0 ? (
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
                      {job.department.Name}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </CardGrid>
        </Section>
      ) : null}

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

      {units.length > 0 ? (
        <Section className="border-edge border-t" tone="paper">
          <SectionHeading>{t("units.title")}</SectionHeading>
          <p className="type-body-sm mb-6 max-w-(--measure) text-ink-muted">
            {t("units.lede", { count: units.length })}
          </p>
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((unit) => {
              const href = unit.slug
                ? unitCanonicalPath({ campusId: slugId(slug), slug: unit.slug })
                : null;
              return (
                <li className="border-edge border-b py-2" key={unit.id}>
                  {href ? (
                    <Link
                      className="type-body-sm group inline-flex items-center gap-2 text-ink transition-colors hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      href={href}
                    >
                      {unit.name}
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3.5 opacity-0 transition-opacity group-hover:opacity-70"
                      />
                    </Link>
                  ) : (
                    <span className="type-body-sm text-ink">{unit.name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

/** `unitCanonicalPath` keys on the campus id, the page knows the slug. */
function slugId(slug: string): string {
  const ids: Record<string, string> = {
    oslo: "1",
    bergen: "2",
    trondheim: "3",
    stavanger: "4",
    national: "5",
  };
  return ids[slug] ?? "";
}
