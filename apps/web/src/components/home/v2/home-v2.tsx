import type { Events, News } from "@repo/api/types/appwrite";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Partner } from "@/app/actions/about";
import { CardGrid } from "@/components/ui/card-grid";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { DateBlock } from "@/components/ui/date-block";
import { OptionalLink } from "@/components/ui/optional-link";
import { Pill } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPrimaryTranslation } from "@/lib/content-translation";
import { HeroChevron } from "./hero-chevron";
import { PartnerLink } from "./partner-link";

/**
 * The redesigned home page.
 *
 * Everything below the hero is a Server Component; only the hero is a client
 * island, because the collage reads the active campus and carries the single
 * orchestrated motion moment.
 *
 * **No invented content.** Every string comes from the `home` message bundle or
 * from `ContentTranslations`, and a section is omitted entirely when its source
 * returns nothing. The reference's notification bar (PLACEHOLDER-005) has no
 * push infrastructure behind it and is not built; member counts
 * (PLACEHOLDER-004) are not public data and are not shown.
 */
export interface HomeV2Props {
  eventCount: number;
  events: Events[];
  jobCount: number;
  locale: string;
  news: News[];
  partners: Partner[];
}

const HOME_EVENTS = 4;
const HOME_NEWS = 3;

export async function HomeV2({
  events,
  news,
  partners,
  eventCount,
  jobCount,
  locale,
}: HomeV2Props) {
  const [t, tNav] = await Promise.all([
    getTranslations("home"),
    getTranslations("common.navigation"),
  ]);

  return (
    <>
      <HeroChevron eventCount={eventCount} jobCount={jobCount} />

      <Section tone="paper">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Events. The marker means "there is more behind this" — it appears
              because there is a destination, not for decoration. */}
          <div>
            <SectionHeading
              seeAllHref="/events"
              seeAllLabel={t("hero.ctas.viewAllEvents")}
            >
              {tNav("events")}
            </SectionHeading>
            {events.length > 0 ? (
              <ul className="space-y-4">
                {events.slice(0, HOME_EVENTS).map((event) => {
                  const translation = getPrimaryTranslation(event, locale);
                  return (
                    <li key={event.$id}>
                      <OptionalLink
                        className="flex items-start gap-4 rounded-biso-md border border-edge p-4 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
                        href={event.slug ? `/events/${event.slug}` : null}
                      >
                        {event.start_date ? (
                          <DateBlock date={event.start_date} locale={locale} />
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
                          {/* Derived from real data, never hardcoded. */}
                          <span className="mt-2 inline-flex">
                            <Pill
                              tone={event.ticket_url ? "success" : "accent"}
                            >
                              {event.ticket_url
                                ? t("events.registerNow")
                                : t("events.infoOnly")}
                            </Pill>
                          </span>
                        </span>
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
              seeAllHref="/news"
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
                        className="flex items-start gap-4 rounded-biso-md border border-edge p-4 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
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

      {partners.length > 0 && (
        <Section tone="paper">
          <SectionHeading>{t("partners.title")}</SectionHeading>
          <CardGrid columns={4}>
            {partners.slice(0, 8).map((partner) => {
              const logo = (
                <ChevronFrame
                  className="border border-edge bg-surface-raised"
                  ratio="16/9"
                >
                  <Image
                    alt={partner.name}
                    className="object-contain p-4"
                    height={120}
                    sizes="(max-width: 640px) 50vw, 220px"
                    src={partner.image_url}
                    width={220}
                  />
                </ChevronFrame>
              );
              return (
                <li key={partner.$id}>
                  {partner.url ? (
                    <PartnerLink name={partner.name} url={partner.url}>
                      {logo}
                    </PartnerLink>
                  ) : (
                    logo
                  )}
                </li>
              );
            })}
          </CardGrid>
        </Section>
      )}
    </>
  );
}
