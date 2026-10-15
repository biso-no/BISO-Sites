"use client";

import type { Locale } from "@repo/i18n/config";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface OverviewSectionProps {
  campusName: string | null;
  departmentsCount: number;
  eventCount: number;
  focusAreas: string[];
  jobCount: number;
  locale: Locale;
}

/**
 * The short version of "what is BISO here": three numbers, two sentences and
 * the campus's focus areas. Plain type on purpose; the content is the point.
 */
export function OverviewSection({
  campusName,
  departmentsCount,
  eventCount,
  focusAreas,
  jobCount,
  locale,
}: OverviewSectionProps) {
  const t = useTranslations("home");
  const stats = [
    { href: "/events", label: t("about.upcomingEvents"), value: eventCount },
    { href: "/jobs", label: t("about.jobOpportunities"), value: jobCount },
    {
      href: "/units",
      label: t("about.studentGroups"),
      value: departmentsCount,
    },
  ];
  const focusTitle =
    locale === "en" ? "What we focus on" : "Dette jobber vi med";

  return (
    <section
      className="border-border/60 border-y bg-background py-16"
      id="about"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[3fr_2fr] lg:px-8">
        <div>
          <p className="mb-3 font-medium text-brand text-sm uppercase tracking-wide">
            {campusName
              ? t("overview.eyebrowCampus", { campusName })
              : t("overview.eyebrow")}
          </p>
          <h2 className="mb-6 font-bold text-3xl text-foreground md:text-4xl">
            {t("about.mainContent.premier")}{" "}
            {t("about.mainContent.studentCommunity")}
          </h2>
          <p className="mb-4 text-lg text-muted-foreground leading-relaxed">
            {t("about.mainContent.paragraph1")}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {t("about.mainContent.paragraph2")}
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-border/60 border-t pt-8">
            {stats.map((stat) => (
              <Link
                className="group flex flex-col rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={stat.href}
                key={stat.href}
              >
                <dt className="order-2 text-muted-foreground text-sm group-hover:text-brand">
                  {stat.label}
                </dt>
                <dd className="font-bold text-3xl text-foreground tabular-nums">
                  {stat.value}
                </dd>
              </Link>
            ))}
          </dl>
        </div>

        {focusAreas.length > 0 ? (
          <div className="rounded-2xl bg-brand-muted p-8">
            <h3 className="mb-5 font-semibold text-brand-dark text-lg">
              {focusTitle}
            </h3>
            <ul className="space-y-3">
              {focusAreas.map((area) => (
                <li
                  className="border-brand/20 border-l-2 pl-4 text-brand-dark"
                  key={area}
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
