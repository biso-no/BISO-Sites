import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listLargeEvents } from "@/app/actions/large-events";
import { getLocale } from "@/app/actions/locale";
import {
  type FeaturedVM,
  ProjectsBody,
  type ScheduleVM,
} from "@/components/projects/projects-body";
import { PageHeader } from "@/components/ui/page-header";
import type { ParsedLargeEvent } from "@/lib/types/large-event";

export const metadata: Metadata = {
  title: "Projects | BISO",
  description:
    "Explore the projects and large events organised by BI Student Organisation across our campuses.",
};

const DEFAULT_GRADIENT = ["#14355B", "#1E3A8A"];
const WINTER_GAMES_GRADIENT = ["#0F172A", "#1E3A8A"];

const pickEventBySlug = (events: ParsedLargeEvent[], slug: string) =>
  events.find((event) => event.slug === slug);

const deriveAccent = (event?: ParsedLargeEvent, fallback?: string[]) => {
  if (event?.gradient && event.gradient.length >= 2) {
    return event.gradient;
  }
  if (event?.primaryColorHex && event?.secondaryColorHex) {
    return [event.primaryColorHex, event.secondaryColorHex];
  }
  return fallback ?? DEFAULT_GRADIENT;
};

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
        gradient: deriveAccent(
          event,
          key === "winterGames" ? WINTER_GAMES_GRADIENT : undefined
        ),
        highlight: config.highlight,
        href: `/projects/${config.slug}`,
        key,
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
      gradient: deriveAccent(event),
      href: `/projects/${event.slug}`,
      id: event.$id,
      slug: event.slug,
      tag: event.showcaseType || undefined,
      title: event.name,
    }));

  const crumbs = [
    { label: tCommon("breadcrumbs.home"), href: "/" },
    { label: tNav("triggers.projects") },
  ];

  // Chrome only. **`large_event` holds zero rows**, so the four projects
  // below come from the `projects` message bundle and their gradients from
  // constants in this file — there is no project data to restyle against,
  // and `01-design-spec.md` §7.4's per-project palette override has nothing
  // to override. See PLACEHOLDER-011.
  return (
    <>
      <PageHeader
        breadcrumbs={crumbs}
        lede={t("hero.subtitle")}
        title={t("hero.title")}
      />
      <ProjectsBody featured={featured} otherEvents={otherEvents} />
    </>
  );
}
