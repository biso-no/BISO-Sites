import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { Pill } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { statusPanelSecondaryAction } from "@/components/ui/status-panel";
import { UnitCrest } from "@/components/units/unit-crest";
import type { ProjectHubCampusVM } from "@/lib/project-hub";

const PROTOCOL_REGEX = /^https?:\/\//;

export interface ProjectScheduleItemVM {
  formattedDate?: string;
  id: string;
  location?: string;
  subtitle?: string;
  ticketUrl?: string;
  title: string;
}

export interface ProjectDetailVM {
  /** The unit running the project on each campus, in campus order. */
  campuses: ProjectHubCampusVM[];
  ctaLabel: string;
  ctaUrl: string | null;
  description: string;
  highlights: string[];
  overview: {
    dateRange?: string | null;
    externalUrl?: string | null;
    type?: string;
  };
  /** The project row's own colours (spec §7.4); `null` when it has none. */
  palette: string[] | null;
  schedule: Array<{ campusName: string; items: ProjectScheduleItemVM[] }>;
  sections: Array<{ body: string; title: string }>;
  tagline?: string;
  title: string;
}

/**
 * `/projects/<slug>` below its header — a Server Component.
 *
 * Main's project hub (#93) on the redesign's primitives: what the project is,
 * then one card per campus team (the unit that runs it there — its crest, its
 * summary, its next three events and a link to its page), then the project's
 * own sections and programme. Every block renders only when it has content,
 * and nothing moves on scroll.
 */
export async function ProjectDetailBody({ vm }: { vm: ProjectDetailVM }) {
  const t = await getTranslations("projectDetail");
  const hasOverviewRows = Boolean(
    vm.overview.dateRange || vm.overview.type || vm.overview.externalUrl
  );

  return (
    <>
      {vm.highlights.length > 0 || hasOverviewRows ? (
        <Section tone="paper">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {vm.highlights.length > 0 ? (
              <ul className="min-w-0 space-y-3">
                {vm.highlights.map((item) => (
                  <li
                    className="type-body border-ink-accent border-l-2 pl-4 text-ink"
                    key={item}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}

            {hasOverviewRows ? (
              <aside
                aria-labelledby="project-overview"
                className={cn(
                  "self-start rounded-biso-md border border-edge p-6",
                  // Keep the rail in the rail's column when there is nothing
                  // beside it.
                  vm.highlights.length === 0 && "lg:col-start-2"
                )}
              >
                <h2
                  className="type-heading-section mb-4 text-ink"
                  id="project-overview"
                >
                  {t("overview.title")}
                </h2>
                <dl className="space-y-3">
                  {vm.overview.dateRange ? (
                    <div>
                      <dt className="type-label text-ink-muted">
                        {t("overview.dates")}
                      </dt>
                      <dd className="type-body-sm text-ink">
                        {vm.overview.dateRange}
                      </dd>
                    </div>
                  ) : null}
                  {vm.overview.type ? (
                    <div>
                      <dt className="type-label text-ink-muted">
                        {t("overview.type")}
                      </dt>
                      <dd className="type-body-sm text-ink">
                        {vm.overview.type}
                      </dd>
                    </div>
                  ) : null}
                  {vm.overview.externalUrl ? (
                    <div>
                      <dt className="type-label text-ink-muted">
                        {t("overview.external")}
                      </dt>
                      <dd className="type-body-sm min-w-0 break-words">
                        <a
                          className="text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          href={vm.overview.externalUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {vm.overview.externalUrl.replace(PROTOCOL_REGEX, "")}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </aside>
            ) : null}
          </div>
        </Section>
      ) : null}

      {vm.campuses.length > 0 ? (
        <Section className="border-edge border-t" id="campuses" tone="paper">
          <SectionHeading className="mb-2">
            {t("campuses.title")}
          </SectionHeading>
          <p className="type-body-sm mb-8 max-w-(--measure) text-ink-muted">
            {t("campuses.subtitle")}
          </p>
          <CardGrid>
            {vm.campuses.map((team) => (
              <li className="min-w-0" key={team.unit.id}>
                <article className="flex h-full flex-col rounded-biso-md border border-edge p-6">
                  <div className="flex items-start gap-4">
                    <UnitCrest className="size-14 text-lg" unit={team.unit} />
                    <div className="min-w-0">
                      {team.campusLabel ? (
                        <Pill tone="accent" uppercase>
                          {team.campusLabel}
                        </Pill>
                      ) : null}
                      <h3 className="type-heading-card mt-2 break-words text-ink">
                        {team.unit.name}
                      </h3>
                    </div>
                  </div>

                  {team.unit.summary ? (
                    <p className="type-body-sm mt-4 line-clamp-3 text-ink-muted">
                      {team.unit.summary}
                    </p>
                  ) : null}

                  <p className="type-label mt-5 text-ink-muted">
                    {t("campuses.upcoming")}
                  </p>
                  {team.events.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {team.events.map((event, eventIndex) => (
                        <li
                          className="border-edge border-l-2 pl-3"
                          // The feed carries no id, and two sessions of the
                          // same event can share a day and a title.
                          key={`${eventIndex}-${event.date}-${event.title}`}
                        >
                          <p className="type-data text-ink-muted">
                            {[event.date, event.where]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="type-body-sm mt-0.5 break-words text-ink">
                            {event.title}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="type-body-sm mt-2 text-ink-muted">
                      {t("campuses.noEvents")}
                    </p>
                  )}

                  <div className="mt-auto pt-6">
                    <Link
                      className={statusPanelSecondaryAction}
                      href={team.unit.href}
                    >
                      {t("campuses.visit", { name: team.unit.name })}
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </CardGrid>
        </Section>
      ) : null}

      {vm.sections.length > 0 ? (
        <Section className="border-edge border-t" tone="paper">
          <div className="grid gap-10 md:grid-cols-2">
            {vm.sections.map((section) => (
              <div className="min-w-0" key={section.title}>
                {/* The page's top-level sections: h2 under the header's h1. */}
                <h2 className="type-display-sm break-words text-ink">
                  {section.title}
                </h2>
                <p className="type-body mt-4 max-w-(--measure) text-ink-muted">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {vm.schedule.length > 0 ? (
        <Section className="border-edge border-t" id="schedule" tone="paper">
          <SectionHeading className="mb-2">
            {t("schedule.title")}
          </SectionHeading>
          <p className="type-body-sm mb-8 max-w-(--measure) text-ink-muted">
            {t("schedule.subtitle")}
          </p>
          <div className="grid gap-10 md:grid-cols-2">
            {vm.schedule.map((campus) => (
              <div className="min-w-0" key={campus.campusName}>
                <h3 className="type-heading-card mb-4 text-ink">
                  {campus.campusName}
                </h3>
                <ul className="space-y-3">
                  {campus.items.map((item) => (
                    <li
                      className="rounded-biso-md border border-edge p-4"
                      key={item.id}
                    >
                      <p className="type-body-sm break-words font-semibold text-ink">
                        {item.title}
                      </p>
                      {item.subtitle ? (
                        <p className="type-body-sm text-ink-muted">
                          {item.subtitle}
                        </p>
                      ) : null}
                      {item.formattedDate || item.location ? (
                        <p className="type-data mt-2 text-ink-muted">
                          {[item.formattedDate, item.location]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                      {item.ticketUrl ? (
                        <a
                          className="type-label mt-3 inline-flex text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          href={item.ticketUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {t("schedule.ticket")}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}
