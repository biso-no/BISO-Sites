import { getTranslations } from "next-intl/server";
import { StatRow } from "@/components/ui/stat-row";
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

export async function HistorySection() {
  const t = await getTranslations("about.pages.history");
  const timeline = t.raw("timeline") as TimelineItem[];
  const stats = t.raw("stats") as StatItem[];

  return (
    <AboutSection id="historie" intro={t("intro")} title={t("title")}>
      <SectionCopy text={t("content")} />

      <SubHeading>{t("timelineTitle")}</SubHeading>
      {/* An ordered list of dated events — what a screen reader and a crawler
          get too. The old timeline faded each entry in on scroll. */}
      <ol className="max-w-(--measure) border-edge border-s ps-6">
        {timeline.map((entry) => (
          <li className="relative pb-8 last:pb-0" key={entry.id}>
            <span
              aria-hidden="true"
              className="absolute -start-[1.9rem] top-1.5 size-2.5 rounded-full bg-action"
            />
            <span className="type-data block text-ink-accent">
              {entry.year}
            </span>
            <h4 className="type-heading-card mt-1 text-ink">{entry.title}</h4>
            <p className="type-body mt-1 text-ink-muted">{entry.description}</p>
          </li>
        ))}
      </ol>

      <SubHeading>{t("statsTitle")}</SubHeading>
      <StatRow stats={stats} />
    </AboutSection>
  );
}
