"use client";

import { CheckCircle2, GraduationCap, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { ForumList } from "@/components/about/forum-list";
import { PdfCta } from "@/components/about/pdf-cta";
import { PolicyCards } from "@/components/about/policy-cards";
import { CtaCard } from "./cta-card";
import { AboutSection, SectionCopy, SubHeading } from "./section-shell";

interface CardItem {
  description: string;
  id: string;
  title: string;
}

/** Your voice in academia: focus areas, wins, forums, how to raise a case. */
export function StudyQualitySection() {
  const t = useTranslations("about.pages.studyQuality");
  const tAbout = useTranslations("about");
  const focus = [0, 1, 2, 3, 4].map((i) =>
    tAbout(`general.academics.items.${i}`)
  );
  const wins = t.raw("wins") as CardItem[];
  const forums = t.raw("forums") as CardItem[];

  return (
    <AboutSection
      eyebrow={tAbout("general.academics.title")}
      id="studiekvalitet"
      intro={t("intro")}
      title={t("title")}
      wide
    >
      <div className="grid items-start gap-12 lg:grid-cols-2">
        <SectionCopy text={t("content")} />
        <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-brand" />
            <h3 className="font-semibold text-foreground text-lg">
              {tAbout("general.academics.subtitle")}
            </h3>
          </div>
          <ul className="space-y-3">
            {focus.map((item) => (
              <li className="flex items-start gap-3" key={item}>
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SubHeading>{t("winsTitle")}</SubHeading>
      <PolicyCards items={wins} />
      <SubHeading>{t("forumsTitle")}</SubHeading>
      <ForumList items={forums} />
      <div className="mt-12 grid gap-6">
        <CtaCard
          cta={t("yourCase.cta")}
          description={t("yourCase.description")}
          href="/contact"
          icon={MessageSquare}
          title={t("yourCase.title")}
        />
        <PdfCta
          description={t("targetDoc.description")}
          href={t("targetDoc.href")}
          title={t("targetDoc.title")}
        />
      </div>
    </AboutSection>
  );
}
