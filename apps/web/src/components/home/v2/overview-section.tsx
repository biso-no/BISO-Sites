import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * "What is BISO here": a short intro, three live counts and the campus's focus
 * areas — the overview the Branding Committee moved from `/campus` to the front
 * page (batch G). Plain type on purpose; the content is the point, so there are
 * no icon tiles and no cards.
 *
 * **Counts are real or absent (PLACEHOLDER-004).** Each figure comes from
 * `cachedHomeCounts`, which uses the same filters as the listing it links to,
 * so the number matches what the visitor finds there. A zero drops the figure
 * rather than printing "0 open positions" — and zero is also what a failed
 * count falls back to, so an outage never shows as a fact. The markup is
 * `StatRow`'s, with the label as the link to its listing.
 *
 * **Focus areas are omitted until they exist.** They come from
 * `campus_metadata`, which is empty today (PLACEHOLDER-009); the column appears
 * the day a campus writes them, with no code change.
 */
export interface OverviewSectionProps {
  /** The selected campus for the eyebrow; null for all campuses and National. */
  campusName: string | null;
  departmentCount: number;
  eventCount: number;
  focusAreas: string[];
  /** Listing URLs, scoped to the same campus as the counts. */
  hrefs: { events: string; jobs: string; units: string };
  jobCount: number;
}

export async function OverviewSection({
  campusName,
  departmentCount,
  eventCount,
  focusAreas,
  hrefs,
  jobCount,
}: OverviewSectionProps) {
  const t = await getTranslations("home");

  const stats = [
    { href: hrefs.events, label: t("about.upcomingEvents"), value: eventCount },
    { href: hrefs.jobs, label: t("about.jobOpportunities"), value: jobCount },
    {
      href: hrefs.units,
      label: t("about.studentGroups"),
      value: departmentCount,
    },
  ]
    // Only real counts. No invented "1000+ members" tile, and no zeros.
    .filter((stat) => stat.value > 0);
  const hasFocusAreas = focusAreas.length > 0;

  return (
    <Section className="border-edge border-t" id="about" tone="paper">
      <div
        className={cn(
          "grid gap-12",
          hasFocusAreas && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        )}
      >
        <div className="min-w-0">
          <p className="type-label mb-3 text-ink-accent">
            {campusName
              ? t("overview.eyebrowCampus", { campusName })
              : t("overview.eyebrow")}
          </p>
          <SectionHeading>
            {t("about.mainContent.premier")}{" "}
            {t("about.mainContent.studentCommunity")}
          </SectionHeading>
          <div className="max-w-(--measure) space-y-4">
            <p className="type-body text-ink">
              {t("about.mainContent.paragraph1")}
            </p>
            <p className="type-body text-ink-muted">
              {t("about.mainContent.paragraph2")}
            </p>
          </div>

          {stats.length > 0 ? (
            <dl className="mt-10 grid grid-cols-2 gap-6 border-edge border-t pt-8 sm:grid-cols-3">
              {stats.map((stat) => (
                <div className="flex flex-col gap-1" key={stat.href}>
                  <dt className="type-body-sm order-2">
                    <Link
                      className="text-ink-muted underline-offset-4 hover:text-ink-accent hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      href={stat.href}
                    >
                      {stat.label}
                    </Link>
                  </dt>
                  <dd className="type-data order-1 text-3xl text-ink leading-none">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {hasFocusAreas ? (
          <div className="self-start rounded-biso-md border border-edge p-6">
            <h3 className="type-heading-card text-ink">
              {t("overview.focusTitle")}
            </h3>
            <ul className="mt-4 space-y-3">
              {focusAreas.map((area) => (
                <li
                  className="type-body border-ink-accent border-l-2 pl-4 text-ink"
                  key={area}
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
