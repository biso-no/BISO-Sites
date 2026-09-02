"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SectionHeading } from "@/components/shared/section-heading";

const PROTOCOL_REGEX = /^https?:\/\//;

const HTTP_PREFIX = "http";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  viewport: { once: true },
  whileInView: { opacity: 1, y: 0 },
} as const;

export interface ProjectScheduleItemVM {
  formattedDate?: string;
  id: string;
  location?: string;
  subtitle?: string;
  ticketUrl?: string;
  title: string;
}

export interface ProjectDetailVM {
  ctaLabel: string;
  ctaUrl: string | null;
  description: string;
  gradient: string[];
  highlights: string[];
  overview: {
    dateRange?: string | null;
    externalUrl?: string | null;
    type?: string;
  };
  schedule: Array<{ campusName: string; items: ProjectScheduleItemVM[] }>;
  sections: Array<{ body: string; title: string }>;
  tagline?: string;
  title: string;
}

export function ProjectDetailBody({ vm }: { vm: ProjectDetailVM }) {
  const t = useTranslations("projectDetail");
  const accentDot = vm.gradient[0] ?? "#14355B";
  const hasOverviewRows = Boolean(
    vm.overview.dateRange || vm.overview.type || vm.overview.externalUrl
  );

  return (
    <>
      {/* Overview / intro */}
      <section className="relative overflow-hidden py-16" id="about-content">
        <div className="pointer-events-none absolute inset-0 bg-grid-primary-soft opacity-50" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[3fr_2fr] lg:px-8">
          <motion.div
            className="surface-spotlight space-y-6"
            transition={{ duration: 0.6 }}
            {...fadeUp}
          >
            {vm.tagline ? (
              <div className="inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm uppercase tracking-wide">
                {vm.tagline}
              </div>
            ) : null}
            <p className="text-lg text-muted-foreground leading-relaxed">
              {vm.description}
            </p>
            {vm.highlights.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {vm.highlights.map((item) => (
                  <span
                    className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand-muted px-4 py-2 text-brand-dark text-sm"
                    key={item}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: accentDot }}
                    />
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
            {vm.ctaUrl ? (
              <Button asChild size="lg" variant="gradient">
                <a
                  href={vm.ctaUrl}
                  rel="noreferrer"
                  target={
                    vm.ctaUrl.startsWith(HTTP_PREFIX) ? "_blank" : undefined
                  }
                >
                  {vm.ctaLabel}
                </a>
              </Button>
            ) : null}
          </motion.div>

          {hasOverviewRows ? (
            <motion.div transition={{ delay: 0.15, duration: 0.6 }} {...fadeUp}>
              <Card className="overflow-hidden border-border/50 accent-ring">
                <div
                  className="h-1.5 w-full"
                  style={{
                    background: `linear-gradient(90deg, ${vm.gradient.join(", ")})`,
                  }}
                />
                <CardHeader>
                  {/* RD-031: `CardTitle` is an `<h3>` by default and this card
                      sits directly under the page's `<h1>`, which axe reported
                      as `heading-order`. */}
                  <CardTitle as="h2" className="text-foreground text-xl">
                    {t("overview.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {vm.overview.dateRange ? (
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-foreground">
                        {t("overview.dates")}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {vm.overview.dateRange}
                      </span>
                    </div>
                  ) : null}
                  {vm.overview.type ? (
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-foreground">
                        {t("overview.type")}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {vm.overview.type}
                      </span>
                    </div>
                  ) : null}
                  {vm.overview.externalUrl ? (
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-foreground">
                        {t("overview.external")}
                      </span>
                      <a
                        className="text-right text-brand underline-offset-2 hover:underline"
                        href={vm.overview.externalUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {vm.overview.externalUrl.replace(PROTOCOL_REGEX, "")}
                      </a>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </div>
      </section>

      {/* Content sections */}
      {vm.sections.length > 0 ? (
        <section className="bg-section/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-2">
              {vm.sections.map((section, index) => (
                <motion.div
                  key={section.title}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  {...fadeUp}
                >
                  <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <CardHeader>
                      {/* Same reason as the overview card: these are the
                          page's top-level sections, not sub-sections. */}
                      <CardTitle as="h2" className="text-foreground text-xl">
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">
                        {section.body}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Campus schedule */}
      {vm.schedule.length > 0 ? (
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              className="mb-10"
              transition={{ duration: 0.6 }}
              {...fadeUp}
            >
              <SectionHeading
                subtitle={t("schedule.subtitle")}
                title={t("schedule.title")}
              />
            </motion.div>
            <div className="grid gap-6 md:grid-cols-2">
              {vm.schedule.map((campus, index) => (
                <motion.div
                  key={campus.campusName}
                  transition={{ delay: index * 0.08, duration: 0.5 }}
                  {...fadeUp}
                >
                  <Card className="h-full border-border/50">
                    <CardHeader>
                      <CardTitle className="text-foreground text-lg">
                        {campus.campusName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {campus.items.map((item) => (
                        <div
                          className="rounded-xl border border-border/50 bg-muted/30 p-3"
                          key={item.id}
                        >
                          <p className="font-semibold text-foreground text-sm">
                            {item.title}
                          </p>
                          {item.subtitle ? (
                            <p className="text-muted-foreground text-xs">
                              {item.subtitle}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-col gap-1 text-muted-foreground text-xs">
                            {item.formattedDate ? (
                              <span>{item.formattedDate}</span>
                            ) : null}
                            {item.location ? (
                              <span>{item.location}</span>
                            ) : null}
                            {item.ticketUrl ? (
                              <Link
                                className="text-brand underline-offset-2 hover:underline"
                                href={item.ticketUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {t("schedule.ticket")}
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
