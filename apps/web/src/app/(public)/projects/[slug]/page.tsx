import type { Locale } from "@repo/i18n/config";
import {
  isProjectSlug,
  type ProjectSlug,
  projectPageSlug,
} from "@repo/shared/utils/project-units";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { getCampusMetadata } from "@/app/actions/campus";
import { getLargeEventBySlug } from "@/app/actions/large-events";
import { getLocale } from "@/app/actions/locale";
import {
  ProjectDetailBody,
  type ProjectDetailVM,
} from "@/components/projects/project-detail-body";
import {
  paletteBackground,
  projectPalette,
} from "@/components/projects/project-palette";
import { type Crumb, PageHeader } from "@/components/ui/page-header";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";
import {
  cachedPageEventsFeed,
  cachedPublishedPage,
} from "@/lib/data/public-content";
import { cachedPublicUnits } from "@/lib/data/units";
import { buildProjectHub, HUB_EVENT_LIMIT } from "@/lib/project-hub";
import {
  boundDepartmentTheme,
  isRenderablePage,
  renderPublishedEditorPage,
} from "@/lib/published-editor-page";
import type { ParsedLargeEvent } from "@/lib/types/large-event";
import { isServableProjectPage } from "@/lib/unit-page";

/**
 * The project's published editor page, or null: only a known project may have
 * one (the page table also holds `projects/<anything>` rows an editor could
 * have typed). A failed read, and a page with nothing to show, fall back to
 * the coded hub.
 */
const publishedProjectPage = cache(async (slug: string, locale: Locale) => {
  if (!isProjectSlug(slug)) {
    return null;
  }
  const result = await cachedPublishedPage(projectPageSlug(slug), locale).catch(
    () => null
  );
  if (!isRenderablePage(result)) {
    return null;
  }
  return (await isServableProjectPage(result, slug)) ? result : null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const page = await publishedProjectPage(
      slug,
      (await getLocale()) as Locale
    );
    const pageTitle = page?.translation?.title;
    if (pageTitle) {
      return {
        title: `${pageTitle} | BISO`,
        description: page?.translation?.description?.slice(0, 160) || undefined,
      };
    }
    const [event, t] = await Promise.all([
      getLargeEventBySlug(slug),
      getTranslations("projectDetail"),
    ]);
    // Only a known project may borrow message copy: the bundle also holds
    // UI strings ("campuses", "schedule"…) that would otherwise title a page.
    const hasCopy = isProjectSlug(slug) && t.has(`${slug}.title`);
    const title = event?.name ?? (hasCopy ? t(`${slug}.title`) : slug);
    const description =
      event?.description ??
      (hasCopy && t.has(`${slug}.description`)
        ? t(`${slug}.description`)
        : undefined);
    return {
      title: `${title} | BISO`,
      description: description?.slice(0, 160),
    };
  } catch {
    return { title: "Projects | BISO" };
  }
}

/** An absolute web URL opens in a new tab; a site path does not. */
const HTTP_URL = /^https?:\/\//;

const parseDateRange = (event: ParsedLargeEvent, locale: Locale) => {
  if (!event.startDate) {
    return null;
  }
  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : null;
  const formatter = new Intl.DateTimeFormat(
    locale === "en" ? "en-GB" : "nb-NO",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
  if (!end) {
    return formatter.format(start);
  }
  return `${formatter.format(start)} – ${formatter.format(end)}`;
};

const pickValue = <T,>(
  locale: Locale,
  nbValue?: T,
  enValue?: T,
  fallback?: T
) =>
  locale === "en"
    ? (enValue ?? nbValue ?? fallback)
    : (nbValue ?? enValue ?? fallback);

const formatScheduleDate = (
  item: NonNullable<ParsedLargeEvent["items"]>[number],
  locale: Locale
) => {
  if (!item.startTime) {
    return;
  }
  return new Date(item.startTime).toLocaleString(
    locale === "en" ? "en-GB" : "nb-NO",
    {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;

  // A published editor page at `projects/<slug>` replaces the coded hub; its
  // department binding (the national unit) supplies the theme, an unbound hub
  // page its document's own.
  const editorPage = await publishedProjectPage(slug, locale);
  if (editorPage) {
    return renderPublishedEditorPage({
      departmentTheme: await boundDepartmentTheme(editorPage),
      locale,
      result: editorPage,
      slug: projectPageSlug(slug as ProjectSlug),
    });
  }

  const t = await getTranslations("projectDetail");
  const tNav = await getTranslations("common.navigation");
  const tCommon = await getTranslations("common");

  // The unit directory is the shared cache entry /units reads; a failure
  // costs this render its campus cards, never the page.
  const [event, campusMetadata, units] = await Promise.all([
    getLargeEventBySlug(slug),
    getCampusMetadata(),
    cachedPublicUnits(locale).catch(() => []),
  ]);

  // `t.raw()` answers a missing key with the key path itself, which is truthy,
  // so presence has to be checked explicitly or an unknown slug never 404s.
  // The bundle also holds UI strings ("campuses", "schedule", "overview"),
  // so only a known project slug may read copy from it.
  const fallbackConfig =
    isProjectSlug(slug) && t.has(slug)
      ? (t.raw(slug) as Record<string, unknown>)
      : undefined;

  if (!(event || fallbackConfig)) {
    return notFound();
  }

  const metadata = (event?.parsedMetadata ?? {}) as Record<string, unknown>;
  const meta = <T,>(key: string) => metadata[key] as T | undefined;

  const title =
    event?.name ?? (fallbackConfig?.title as string | undefined) ?? slug;
  const description =
    event?.description ??
    (fallbackConfig?.description as string | undefined) ??
    t("fallback.description");
  const tagline = fallbackConfig?.tagline as string | undefined;
  // The project row's own colours, or nothing (spec §7.4, PLACEHOLDER-011).
  const palette = projectPalette(event);

  const ctaUrl =
    meta<string>("cta_url") ??
    event?.externalUrl ??
    (fallbackConfig?.ctaUrl as string | undefined) ??
    null;
  const ctaLabel =
    pickValue(
      locale,
      meta<string>("cta_label_nb"),
      meta<string>("cta_label_en")
    ) ??
    (fallbackConfig?.ctaLabel as string | undefined) ??
    t("fallback.cta");

  const highlights =
    pickValue<string[]>(
      locale,
      meta<string[]>("highlights_nb"),
      meta<string[]>("highlights_en")
    ) ??
    (fallbackConfig?.highlights as string[] | undefined) ??
    [];

  const sections =
    pickValue(
      locale,
      meta<Array<{ title: string; body: string }>>("sections_nb"),
      meta<Array<{ title: string; body: string }>>("sections_en")
    ) ??
    (fallbackConfig?.sections as
      | Array<{ title: string; body: string }>
      | undefined) ??
    [];

  const schedule = buildSchedule(event?.items ?? [], campusMetadata, locale);

  const campuses = isProjectSlug(slug)
    ? await buildProjectHub(units, slug, (unitId) =>
        cachedPageEventsFeed(unitId, locale, HUB_EVENT_LIMIT)
      )
    : [];

  const vm: ProjectDetailVM = {
    campuses,
    ctaLabel,
    ctaUrl,
    description,
    highlights,
    overview: {
      dateRange: event ? parseDateRange(event, locale) : undefined,
      externalUrl: event?.externalUrl ?? undefined,
      type: event?.showcaseType ?? undefined,
    },
    palette,
    schedule,
    sections,
    tagline,
    title,
  };

  return (
    <>
      <ProjectHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("triggers.projects"), href: "/projects" },
          { label: title },
        ]}
        ctaLabel={ctaLabel}
        ctaUrl={ctaUrl}
        description={description}
        palette={palette}
        tagline={tagline}
        title={title}
      />
      <ProjectDetailBody vm={vm} />
    </>
  );
}

/** The project's schedule items, grouped by campus in arrival order. */
function buildSchedule(
  items: NonNullable<ParsedLargeEvent["items"]>,
  campusMetadata: Awaited<ReturnType<typeof getCampusMetadata>>,
  locale: Locale
): ProjectDetailVM["schedule"] {
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.campusId ?? "other";
    acc[key] = acc[key] ? [...acc[key], item] : [item];
    return acc;
  }, {});

  return Object.entries(grouped).map(([campusId, campusItems]) => {
    const normalizedKey = campusId.toLowerCase();
    const campusMeta =
      campusMetadata[campusId] || campusMetadata[normalizedKey];
    const campusName =
      campusMeta?.campus_name ?? campusMeta?.campus_id ?? campusId;
    return {
      campusName,
      items: campusItems.map((item) => ({
        formattedDate: formatScheduleDate(item, locale),
        id: item.$id || `${item.title}-${item.startTime}`,
        location: item.location,
        subtitle: item.subtitle,
        ticketUrl: item.ticketUrl,
        title: item.title,
      })),
    };
  });
}

/**
 * The project's header: the site's navy band, the project's tagline over its
 * name, its call to action, and — only when the project row supplies one — its
 * own palette in the chevron frame (spec §7.4). No stand-in colour is drawn.
 */
function ProjectHeader({
  breadcrumbs,
  ctaLabel,
  ctaUrl,
  description,
  palette,
  tagline,
  title,
}: {
  breadcrumbs: Crumb[];
  ctaLabel: string;
  ctaUrl: string | null;
  description: string;
  palette: string[] | null;
  tagline?: string;
  title: string;
}) {
  const isExternal = ctaUrl ? HTTP_URL.test(ctaUrl) : false;
  return (
    <PageHeader
      actions={
        ctaUrl ? (
          <a
            className={statusPanelPrimaryAction}
            href={ctaUrl}
            rel={isExternal ? "noopener noreferrer" : undefined}
            target={isExternal ? "_blank" : undefined}
          >
            {ctaLabel}
          </a>
        ) : undefined
      }
      breadcrumbs={breadcrumbs}
      eyebrow={tagline}
      lede={description}
      media={
        palette ? (
          <span
            aria-hidden="true"
            className="block size-full"
            style={{ background: paletteBackground(palette) }}
          />
        ) : undefined
      }
      title={title}
    />
  );
}
