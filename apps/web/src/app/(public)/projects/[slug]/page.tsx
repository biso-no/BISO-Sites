import type { Locale } from "@repo/i18n/config";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCampusMetadata } from "@/app/actions/campus";
import { getLargeEventBySlug } from "@/app/actions/large-events";
import { getLocale } from "@/app/actions/locale";
import { AboutHero } from "@/components/about/about-hero";
import {
  ProjectDetailBody,
  type ProjectDetailVM,
} from "@/components/projects/project-detail-body";
import type { ParsedLargeEvent } from "@/lib/types/large-event";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const event = await getLargeEventBySlug(slug);
    const title = event?.name ?? slug;
    const description = event?.description ?? undefined;
    return {
      title: `${title} | BISO`,
      description: description?.slice(0, 160),
    };
  } catch {
    return { title: "Projects | BISO" };
  }
}

const DEFAULT_GRADIENT = ["#14355B", "#1E3A8A"];

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
  const t = await getTranslations("projectDetail");
  const tNav = await getTranslations("common.navigation");
  const tCommon = await getTranslations("common");

  const [event, campusMetadata] = await Promise.all([
    getLargeEventBySlug(slug),
    getCampusMetadata(),
  ]);

  const fallbackConfig =
    (t.raw(slug) as Record<string, unknown> | undefined) ?? undefined;

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
  const gradient = event?.gradient ??
    (fallbackConfig?.gradient as string[] | undefined) ?? [
      event?.primaryColorHex ?? DEFAULT_GRADIENT[0],
      event?.secondaryColorHex ?? DEFAULT_GRADIENT[1],
    ];

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

  const items = event?.items ?? [];
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.campusId ?? "other";
    acc[key] = acc[key] ? [...acc[key], item] : [item];
    return acc;
  }, {});

  const schedule = Object.entries(grouped).map(([campusId, campusItems]) => {
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

  const vm: ProjectDetailVM = {
    ctaLabel,
    ctaUrl,
    description,
    gradient,
    highlights,
    overview: {
      dateRange: event ? parseDateRange(event, locale) : undefined,
      externalUrl: event?.externalUrl ?? undefined,
      type: event?.showcaseType ?? undefined,
    },
    schedule,
    sections,
    tagline,
    title,
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("triggers.projects"), href: "/projects" },
          { label: title },
        ]}
        icon={<Sparkles className="h-8 w-8 text-white" />}
        subtitle={tagline ?? description}
        title={title}
      />
      <ProjectDetailBody vm={vm} />
    </div>
  );
}
