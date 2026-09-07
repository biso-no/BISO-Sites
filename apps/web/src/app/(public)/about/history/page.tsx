import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatRow } from "@/components/ui/stat-row";

interface TimelineEntry {
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about.pages.history");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

export default async function HistoryPage() {
  const [t, tCommon, tAbout] = await Promise.all([
    getTranslations("about.pages.history"),
    getTranslations("common"),
    getTranslations("about"),
  ]);

  const timeline = t.raw("timeline") as TimelineEntry[];
  const stats = t.raw("stats") as StatItem[];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tAbout("hub.title"), href: "/about" },
          { label: t("title") },
        ]}
        lede={t("intro")}
        title={t("title")}
      />

      <Section id="about-content" tone="paper" width="prose">
        <Prose>
          <p className="whitespace-pre-line">{t("content")}</p>
        </Prose>
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("timelineTitle")}</SectionHeading>
        {/* `<HistoryTimeline>` was a Client Component whose only job was to
            fade each entry in on scroll. The timeline is an ordered list of
            dated events, which is what it is now — and what a screen reader
            and a crawler get. */}
        <ol className="border-edge border-s ps-6">
          {timeline.map((entry) => (
            <li className="relative pb-8 last:pb-0" key={entry.id}>
              <span
                aria-hidden="true"
                className="absolute -start-[1.9rem] top-1.5 size-2.5 rounded-full bg-action"
              />
              <span className="type-data block text-ink-accent">
                {entry.year}
              </span>
              <h3 className="type-heading-card mt-1 text-ink">{entry.title}</h3>
              <p className="type-body mt-1 text-ink-muted">
                {entry.description}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("statsTitle")}</SectionHeading>
        <StatRow stats={stats} />

        <Link
          className="mt-12 inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          href="/about"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          <span className="type-label">{tAbout("hub.title")}</span>
        </Link>
      </Section>
    </>
  );
}
