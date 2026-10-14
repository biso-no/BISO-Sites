"use client";

import { Users } from "lucide-react";
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

export function PoliticsSection() {
  const t = useTranslations("about.pages.politics");
  const demands = t.raw("policyDemands") as CardItem[];
  const forums = t.raw("forums") as CardItem[];

  return (
    <AboutSection
      id="politikk"
      intro={t("intro")}
      muted
      title={t("title")}
      wide
    >
      <SectionCopy text={t("content")} />
      <SubHeading>{t("policyDemandsTitle")}</SubHeading>
      <PolicyCards items={demands} />
      <SubHeading>{t("forumsTitle")}</SubHeading>
      <ForumList items={forums} />
      <div className="mt-12 grid gap-6">
        <CtaCard
          cta={t("spu.cta")}
          description={t("spu.description")}
          href="/contact"
          icon={Users}
          title={t("spu.title")}
        />
        <PdfCta
          description={t("policyPdf.description")}
          href={t("policyPdf.href")}
          title={t("policyPdf.title")}
        />
      </div>
    </AboutSection>
  );
}
