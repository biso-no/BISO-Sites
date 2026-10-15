"use client";

import { useTranslations } from "next-intl";
import { HistoryTimeline } from "@/components/about/history-timeline";
import { StatsBar } from "@/components/about/stats-bar";
import { AboutSection, SectionCopy, SubHeading } from "./section-shell";

interface TimelineItem {
  description: string;
  id: string;
  title: string;
  year: string;
}

interface StatItem {
  id: string;
  label: string;
  value: string;
}

export function HistorySection() {
  const t = useTranslations("about.pages.history");
  const timeline = t.raw("timeline") as TimelineItem[];
  const stats = t.raw("stats") as StatItem[];

  return (
    <AboutSection id="historie" intro={t("intro")} title={t("title")} wide>
      <div className="max-w-4xl">
        <SectionCopy text={t("content")} />
      </div>
      <SubHeading>{t("timelineTitle")}</SubHeading>
      <div className="max-w-3xl">
        <HistoryTimeline items={timeline} />
      </div>
      <SubHeading>{t("statsTitle")}</SubHeading>
      <StatsBar items={stats} />
    </AboutSection>
  );
}
