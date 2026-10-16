import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listLargeEvents } from "@/app/actions/large-events";
import { getLocale } from "@/app/actions/locale";
import { projectPalette } from "@/components/projects/project-palette";
import {
  type FeaturedVM,
  ProjectsBody,
  type ScheduleVM,
} from "@/components/projects/projects-body";
import { PageHeader } from "@/components/ui/page-header";
import { statusPanelSecondaryAction } from "@/components/ui/status-panel";
import type { ParsedLargeEvent } from "@/lib/types/large-event";

export const metadata: Metadata = {
  title: "Projects | BISO",
  description:
    "Explore the projects and large events organised by BI Student Organisation across our campuses.",
};

const pickEventBySlug = (events: ParsedLargeEvent[], slug: string) =>
  events.find((event) => event.slug === slug);

export default async function ProjectsPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("projects");
  const tNav = await getTranslations("common.navigation");
  const tCommon = await getTranslations("common");

  const events = await listLargeEvents({ activeOnly: false, limit: 100 });

  const featuredConfig = (t.raw("featured") ?? {}) as Record<
    string,
    {
      slug: string;
      title: string;
      description: string;
      cta: string;
      highlight?: string;
    }
  >;

  const featured: FeaturedVM[] = Object.entries(featuredConfig).map(
    ([key, config]) => {
      const event = pickEventBySlug(events, config.slug);
      return {
        ctaLabel: config.cta,
        description: event?.description ?? config.description,
        highlight: config.highlight,
        href: `/projects/${config.slug}`,
        key,
        palette: projectPalette(event),
        slug: config.slug,
        title: event?.name ?? config.title,
      };
    }
  );

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "en" ? "en-GB" : "nb-NO"
  );

  const otherEvents: ScheduleVM[] = events
    .filter((event) => !featured.some((item) => item.slug === event.slug))
    .map((event) => ({
      description: event.description,
      formattedDate: event.startDate
        ? dateFormatter.format(new Date(event.startDate))
        : undefined,
      href: `/projects/${event.slug}`,
      id: event.$id,
      palette: projectPalette(event),
      slug: event.slug,
      tag: event.showcaseType || undefined,
      title: event.name,
    }));

  const crumbs = [
    { label: tCommon("breadcrumbs.home"), href: "/" },
    { label: tNav("triggers.projects") },
  ];

  // **`large_event` holds zero rows today** (PLACEHOLDER-011), so the
  // flagships come from the `projects` message bundle and carry no palette;
  // a project row that supplies its colours gets them in its card's chevron
  // frame (spec §7.4).
  return (
    <>
      <PageHeader
        actions={
          otherEvents.length > 0 ? (
            <Link className={statusPanelSecondaryAction} href="#calendar">
              {t("hero.ctaSecondary")}
            </Link>
          ) : undefined
        }
        breadcrumbs={crumbs}
        eyebrow={t("hero.badge")}
        lede={t("hero.subtitle")}
        title={t("hero.title")}
      />
      <ProjectsBody featured={featured} otherEvents={otherEvents} />
    </>
  );
}
