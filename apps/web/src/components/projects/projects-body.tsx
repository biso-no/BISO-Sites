"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ProjectCard } from "@/components/projects/project-card";
import { SectionHeading } from "@/components/shared/section-heading";

export interface FeaturedVM {
  ctaLabel: string;
  description: string;
  gradient: string[];
  highlight?: string;
  href: string;
  key: string;
  slug: string;
  title: string;
}

export interface ScheduleVM {
  description: string;
  formattedDate?: string;
  gradient: string[];
  href: string;
  id: string;
  slug: string;
  tag?: string;
  title: string;
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  viewport: { once: true },
  whileInView: { opacity: 1, y: 0 },
} as const;

const INSIGHT_KEYS = ["item1", "item2", "item3"] as const;

export function ProjectsBody({
  featured,
  otherEvents,
}: {
  featured: FeaturedVM[];
  otherEvents: ScheduleVM[];
}) {
  const t = useTranslations("projects");

  return (
    <>
      {/* Intro / insight */}
      <section className="relative overflow-hidden py-16" id="about-content">
        <div className="pointer-events-none absolute inset-0 bg-grid-primary-soft opacity-60" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[3fr_2fr] lg:px-8">
          <motion.div
            className="surface-spotlight space-y-6"
            transition={{ duration: 0.6 }}
            {...fadeUp}
          >
            <div className="inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
              {t("hero.badge")}
            </div>
            <h2 className="font-bold text-3xl text-foreground leading-tight md:text-4xl">
              {t("hero.title")}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="gradient">
                <Link href="#featured">{t("hero.ctaPrimary")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#calendar">{t("hero.ctaSecondary")}</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            className="h-full"
            transition={{ delay: 0.15, duration: 0.6 }}
            {...fadeUp}
          >
            <div className="glass-panel h-full p-8">
              <h3 className="font-semibold text-foreground text-xl">
                {t("insight.title")}
              </h3>
              <div className="mt-5 space-y-4">
                {INSIGHT_KEYS.map((item) => (
                  <div className="flex items-start gap-3" key={item}>
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t(`insight.${item}`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured */}
      <section className="bg-section/50 py-16" id="featured">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-10"
            transition={{ duration: 0.6 }}
            {...fadeUp}
          >
            <SectionHeading
              gradient
              subtitle={t("featuredSubtitle")}
              title={t("featuredTitle")}
            />
          </motion.div>
          <div className="grid gap-6 md:grid-cols-2">
            {featured.map((project, index) => (
              <motion.div
                key={project.slug}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                {...fadeUp}
              >
                <ProjectCard
                  badge={
                    project.highlight ?? t(`featuredLabels.${project.key}`)
                  }
                  ctaLabel={project.ctaLabel}
                  description={project.description}
                  gradient={project.gradient}
                  href={project.href}
                  title={project.title}
                  variant="featured"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Schedule */}
      <section className="py-16" id="calendar">
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
          {otherEvents.length === 0 ? (
            <Card className="border-2 border-border/60 border-dashed bg-transparent">
              <CardContent className="py-16 text-center text-muted-foreground">
                {t("schedule.empty")}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {otherEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  transition={{ delay: index * 0.08, duration: 0.5 }}
                  {...fadeUp}
                >
                  <ProjectCard
                    badge={event.tag ?? t("schedule.defaultTag")}
                    ctaLabel={t("schedule.more")}
                    description={event.description}
                    formattedDate={event.formattedDate}
                    gradient={event.gradient}
                    href={event.href}
                    title={event.title}
                    variant="schedule"
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
