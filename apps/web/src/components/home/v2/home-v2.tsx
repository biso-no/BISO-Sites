import type { Events, News } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import type { Partner } from "@/app/actions/about";
import { DateBlock } from "@/components/ui/date-block";
import { OptionalLink } from "@/components/ui/optional-link";
import { Pill } from "@/components/ui/pill";
import { RowThumb } from "@/components/ui/row-thumb";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { campusIdToSlug } from "@/lib/campus-scope";
import { getPrimaryTranslation } from "@/lib/content-translation";
import type { HomeCounts } from "@/lib/data/public-content";
import type { PublicUnit } from "@/lib/data/units";
import {
  EVENT_CATEGORY_MESSAGE_KEYS,
  getEventHref,
  resolveEventCategory,
} from "@/lib/types/event";
import { CampusUnits, OpenRoles } from "./campus-sections";
import { type HeroCampus, HeroChevron } from "./hero-chevron";
import { LeadershipSection, LeadershipSkeleton } from "./leadership-section";
import { MembershipBand } from "./membership-band";
import { OverviewSection } from "./overview-section";
import { PartnerGrid } from "./partner-grid";

/**
 * The redesigned home page — the campus overview.
 *
 * The Branding Committee asked for the front page to be the overview of the
 * selected campus (batch G), so the sections run: the hero naming the campus;
 * a short intro with the live counts and the campus's focus areas; the
 * campus's leadership; events and news; open roles and the unit grid; then
 * membership and partners. Every slice is scoped to the campus the page
 * resolved, and every "see all" carries that scope to the listing.
 *
 * Everything below the hero is a Server Component; only the hero is a client
 * island, because it carries the single orchestrated motion moment. The
 * leadership board is the one section that loads on its own, inside a
 * `<Suspense>` boundary, so a slow directory never holds the page.
 *
 * **No invented content.** Every string comes from a message bundle or from
 * the data, and a section is omitted entirely when its source returns nothing.
 * The reference's notification bar (PLACEHOLDER-005) has no push
 * infrastructure behind it and is not built; member counts (PLACEHOLDER-004)
 * are not public data and are not shown.
 */
export interface HomeV2Props {
  /**
   * The selected campus, for copy. `null` for every campus and for National,
   * which is a scope rather than a place.
   */
  campus: HeroCampus | null;
  counts: HomeCounts;
  events: Events[];
  focusAreas: string[];
  isMember: boolean;
  jobs: RecruitmentVacancy[];
  /** Whose board to show, and the management unit's page for the rest. */
  leadership: { campusId: string; teamHref: string | null };
  locale: Locale;
  news: News[];
  partners: Partner[];
  /** The campus the feeds are scoped to (National included); null for all. */
  scopeCampusId: string | null;
  /** The units on the scoped campus, or every unit when unscoped. */
  units: PublicUnit[];
}

const HOME_EVENTS = 4;
const HOME_NEWS = 3;
const HOME_PARTNERS = 8;

const ROW_LINK =
  "flex items-start gap-4 rounded-biso-md border border-edge p-4 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export async function HomeV2({
  campus,
  counts,
  events,
  focusAreas,
  isMember,
  jobs,
  leadership,
  locale,
  news,
  partners,
  scopeCampusId,
  units,
}: HomeV2Props) {
  const [t, tNav, tEvents] = await Promise.all([
    getTranslations("home"),
    getTranslations("common.navigation"),
    getTranslations("events"),
  ]);
  const intlLocale = locale === "no" ? "nb-NO" : "en-GB";
  // A listing link that lands on the same campus the front page shows.
  const scopeSlug = campusIdToSlug(scopeCampusId);
  const listing = (path: string) =>
    scopeSlug ? `${path}?campus=${scopeSlug}` : path;
  const campusName = campus?.name ?? null;

  return (
    <>
      <HeroChevron
        campus={campus}
        eventsHref={listing("/events")}
        isMember={isMember}
      />

      <OverviewSection
        campusName={campusName}
        departmentCount={counts.departmentCount}
        eventCount={counts.eventCount}
        focusAreas={focusAreas}
        hrefs={{
          events: listing("/events"),
          jobs: listing("/jobs"),
          units: listing("/units"),
        }}
        jobCount={counts.jobCount}
      />

      <Suspense fallback={<LeadershipSkeleton />}>
        <LeadershipSection
          campusId={leadership.campusId}
          campusName={campusName}
          teamHref={leadership.teamHref}
        />
      </Suspense>

      <Section className="border-edge border-t" tone="paper">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Events. The marker means "there is more behind this" — it appears
              because there is a destination, not for decoration. */}
          <div>
            <SectionHeading
              seeAllHref={listing("/events")}
              seeAllLabel={t("hero.ctas.viewAllEvents")}
            >
              {tNav("events")}
            </SectionHeading>
            {events.length > 0 ? (
              <ul className="space-y-4">
                {events.slice(0, HOME_EVENTS).map((event) => {
                  const translation = getPrimaryTranslation(event, locale);
                  const category = resolveEventCategory(event);
                  return (
                    <li key={event.$id}>
                      <OptionalLink
                        className={ROW_LINK}
                        href={getEventHref(event)}
                      >
                        {event.start_date ? (
                          <DateBlock
                            date={event.start_date}
                            locale={intlLocale}
                          />
                        ) : null}
                        <span className="min-w-0">
                          <span className="type-heading-card block text-ink">
                            {translation?.title}
                          </span>
                          {event.location ? (
                            <span className="type-body-sm mt-1 block text-ink-muted">
                              {event.location}
                            </span>
                          ) : null}
                          {/* Derived from real data, never hardcoded.
                              Members-only events are listed like any other
                              and marked: the flag limits who can join, not
                              who can see. */}
                          <span className="mt-2 flex flex-wrap gap-2">
                            {category ? (
                              <Pill tone="accent" uppercase>
                                {tEvents(
                                  `filters.${EVENT_CATEGORY_MESSAGE_KEYS[category]}`
                                )}
                              </Pill>
                            ) : null}
                            {event.member_only ? (
                              <Pill tone="warning">
                                {tEvents("card.membersOnly")}
                              </Pill>
                            ) : null}
                            <Pill
                              tone={event.ticket_url ? "success" : "accent"}
                            >
                              {event.ticket_url
                                ? t("events.registerNow")
                                : t("events.infoOnly")}
                            </Pill>
                          </span>
                        </span>
                        <RowThumb className="ml-auto" src={event.image} />
                      </OptionalLink>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="type-body text-ink-muted">{t("events.empty")}</p>
            )}
          </div>

          {/* News */}
          <div>
            <SectionHeading
              seeAllHref={listing("/news")}
              seeAllLabel={t("hero.ctas.viewAllNews")}
            >
              {tNav("news")}
            </SectionHeading>
            {news.length > 0 ? (
              <ul className="space-y-4">
                {news.slice(0, HOME_NEWS).map((article) => {
                  const translation = getPrimaryTranslation(article, locale);
                  return (
                    <li key={article.$id}>
                      <OptionalLink
                        className={ROW_LINK}
                        href={article.slug ? `/news/${article.slug}` : null}
                      >
                        <span className="min-w-0">
                          <span className="type-heading-card block text-ink">
                            {translation?.title}
                          </span>
                          {translation?.short_description ? (
                            <span className="type-body-sm mt-1 block text-ink-muted">
                              {translation.short_description}
                            </span>
                          ) : null}
                        </span>
                        <RowThumb className="ml-auto" src={article.image} />
                      </OptionalLink>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="type-body text-ink-muted">{t("news.empty")}</p>
            )}
          </div>
        </div>
      </Section>

      <OpenRoles jobs={jobs} locale={locale} seeAllHref={listing("/jobs")} />

      <CampusUnits
        seeAllHref={listing("/units")}
        showCampus={scopeCampusId === null}
        units={units}
      />

      {isMember ? null : <MembershipBand />}

      {partners.length > 0 && (
        <PartnerGrid
          limit={HOME_PARTNERS}
          partners={partners}
          title={t("partners.title")}
        />
      )}
    </>
  );
}
