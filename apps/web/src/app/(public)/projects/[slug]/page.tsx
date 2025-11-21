"use server";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCampusMetadata } from "@/app/actions/campus";
import { getLargeEventBySlug } from "@/app/actions/large-events";
import { getLocale } from "@/app/actions/locale";
import type { Locale } from "@/i18n/config";
import type { ParsedLargeEvent } from "@/lib/types/large-event";

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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("projectDetail");

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

  const heroTitle =
    (event?.name as string | undefined) ??
    (fallbackConfig?.title as string | undefined) ??
    slug;
  const heroDescription =
    (event?.description as string | undefined) ??
    (fallbackConfig?.description as string | undefined) ??
    t("fallback.description");
  const heroTagline = fallbackConfig?.tagline as string | undefined;
  const heroGradient = event?.gradient ??
    (fallbackConfig?.gradient as string[] | undefined) ?? [
      event?.primaryColorHex ?? "#14355B",
      event?.secondaryColorHex ?? "#1E3A8A",
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

  const schedule = event?.items ?? [];
  const groupedSchedule = schedule.reduce<Record<string, typeof schedule>>(
    (acc, item) => {
      const key = item.campusId ?? "other";
      acc[key] = acc[key] ? [...acc[key], item] : [item];
      return acc;
    },
    {}
  );

  const dateRange = event ? parseDateRange(event, locale) : undefined;

  return (
    <div className="space-y-16">
      <section className="overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-lg">
        <div
          className="h-2 w-full"
          style={{
            background: `linear-gradient(90deg, ${heroGradient.join(", ")})`,
          }}
        />
        <div className="grid gap-10 p-8 md:grid-cols-[2fr_3fr] md:p-12">
          <div className="space-y-4">
            {heroTagline ? (
              <Badge
                className="border-primary/20 text-primary-70 text-xs uppercase tracking-wide"
                variant="outline"
              >
                {heroTagline}
              </Badge>
            ) : null}
            <h1 className="font-semibold text-3xl text-primary-100 md:text-4xl">
              {heroTitle}
            </h1>
            <p className="text-base text-primary-70 leading-relaxed">
              {heroDescription}
            </p>
            <div className="flex flex-wrap gap-3">
              {highlights.map((item) => (
                <span
                  className="rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-primary-70 text-sm"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
            {ctaUrl && (
              <div className="pt-2">
                <Button asChild size="lg">
                  <a
                    href={ctaUrl}
                    rel="noreferrer"
                    target={ctaUrl.startsWith("http") ? "_blank" : undefined}
                  >
                    {ctaLabel}
                  </a>
                </Button>
              </div>
            )}
          </div>
          <Card className="border-primary/10 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary-100">
                {t("overview.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-primary-70 text-sm">
              {dateRange ? (
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-primary-90">
                    {t("overview.dates")}
                  </span>
                  <span>{dateRange}</span>
                </div>
              ) : null}
              {event?.showcaseType ? (
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-primary-90">
                    {t("overview.type")}
                  </span>
                  <span>{event.showcaseType}</span>
                </div>
              ) : null}
              {event?.externalUrl ? (
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-primary-90">
                    {t("overview.external")}
                  </span>
                  <a
                    className="text-primary-40 underline-offset-2 hover:underline"
                    href={event.externalUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {event.externalUrl.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      {sections.length > 0 && (
        <section className="grid gap-6 md:grid-cols-2">
          {sections.map((section) => (
            <Card className="border-primary/10 bg-white" key={section.title}>
              <CardHeader>
                <CardTitle className="text-primary-100">
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-primary-70 text-sm leading-6">
                  {section.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {Object.keys(groupedSchedule).length > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="font-semibold text-2xl text-primary-100">
              {t("schedule.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("schedule.subtitle")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(groupedSchedule).map(([campusId, items]) => {
              const normalizedKey =
                typeof campusId === "string"
                  ? campusId.toLowerCase()
                  : campusId;
              const campusMeta =
                campusMetadata[campusId] ||
                campusMetadata[normalizedKey as string];
              const campusName =
                campusMeta?.campus_name ?? campusMeta?.campus_id ?? campusId;
              return (
                <Card className="border-primary/10 bg-white" key={campusId}>
                  <CardHeader>
                    <CardTitle className="text-lg text-primary-100">
                      {campusName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-primary-70 text-sm">
                    {items.map((item) => {
                      const day = item.startTime
                        ? new Date(item.startTime).toLocaleString(
                            locale === "en" ? "en-GB" : "nb-NO",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : null;
                      return (
                        <div
                          className="rounded-xl border border-primary/10 bg-muted/40 p-3"
                          key={item.$id || `${item.title}-${item.startTime}`}
                        >
                          <p className="font-semibold text-primary-100 text-sm">
                            {item.title}
                          </p>
                          {item.subtitle ? (
                            <p className="text-muted-foreground text-xs">
                              {item.subtitle}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-col gap-1 text-muted-foreground text-xs">
                            {day ? <span>{day}</span> : null}
                            {item.location ? (
                              <span>{item.location}</span>
                            ) : null}
                            {item.ticketUrl ? (
                              <Link
                                className="text-primary-40 underline-offset-2 hover:underline"
                                href={item.ticketUrl}
                                target="_blank"
                              >
                                {t("schedule.ticket")}
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
