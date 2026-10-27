import { getTranslations } from "next-intl/server";
import { ProjectCard } from "@/components/projects/project-card";
import { CardGrid } from "@/components/ui/card-grid";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

export interface FeaturedVM {
  ctaLabel: string;
  description: string;
  highlight?: string;
  href: string;
  key: string;
  /** The project row's own colours; `null` when it has none. */
  palette: string[] | null;
  slug: string;
  title: string;
}

export interface ScheduleVM {
  description: string;
  formattedDate?: string;
  href: string;
  id: string;
  /** The project row's own colours; `null` when it has none. */
  palette: string[] | null;
  slug: string;
  tag?: string;
  title: string;
}

const INSIGHT_KEYS = ["item1", "item2", "item3"] as const;

/**
 * `/projects` below its header: the flagships, why they matter, and any other
 * project the `large_event` table holds.
 *
 * A Server Component now — the v1 body was a client component only to fade
 * its sections in on scroll. The "more projects" block renders only when
 * there are more projects: `large_event` holds none today (PLACEHOLDER-011),
 * and a section saying so would be furniture.
 */
export async function ProjectsBody({
  featured,
  otherEvents,
}: {
  featured: FeaturedVM[];
  otherEvents: ScheduleVM[];
}) {
  const t = await getTranslations("projects");

  return (
    <>
      <Section id="featured" tone="paper">
        <SectionHeading className="mb-2">{t("featuredTitle")}</SectionHeading>
        <p className="type-body-sm mb-8 max-w-(--measure) text-ink-muted">
          {t("featuredSubtitle")}
        </p>
        <CardGrid columns={featured.length % 2 === 0 ? 2 : 3}>
          {featured.map((project) => (
            <li className="min-w-0" key={project.slug}>
              <ProjectCard
                badge={project.highlight ?? t(`featuredLabels.${project.key}`)}
                ctaLabel={project.ctaLabel}
                description={project.description}
                href={project.href}
                palette={project.palette}
                title={project.title}
                variant="featured"
              />
            </li>
          ))}
        </CardGrid>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("insight.title")}</SectionHeading>
        <ul className="grid gap-6 md:grid-cols-3">
          {INSIGHT_KEYS.map((item) => (
            <li
              className="type-body border-ink-accent border-l-2 pl-4 text-ink"
              key={item}
            >
              {t(`insight.${item}`)}
            </li>
          ))}
        </ul>
      </Section>

      {otherEvents.length > 0 ? (
        <Section className="border-edge border-t" id="calendar" tone="paper">
          <SectionHeading className="mb-2">
            {t("schedule.title")}
          </SectionHeading>
          <p className="type-body-sm mb-8 max-w-(--measure) text-ink-muted">
            {t("schedule.subtitle")}
          </p>
          <CardGrid>
            {otherEvents.map((event) => (
              <li className="min-w-0" key={event.id}>
                <ProjectCard
                  badge={event.tag ?? t("schedule.defaultTag")}
                  ctaLabel={t("schedule.more")}
                  description={event.description}
                  formattedDate={event.formattedDate}
                  href={event.href}
                  palette={event.palette}
                  title={event.title}
                  variant="schedule"
                />
              </li>
            ))}
          </CardGrid>
        </Section>
      ) : null}
    </>
  );
}
