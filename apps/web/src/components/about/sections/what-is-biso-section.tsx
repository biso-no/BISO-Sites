"use client";

import { useTranslations } from "next-intl";
import { StrategyCards } from "@/components/about/strategy-cards";
import { AboutSection, SectionCopy } from "./section-shell";

export function WhatIsBisoSection() {
  const t = useTranslations("about.pages.whatIsBiso");
  return (
    <>
      <AboutSection id="hva-er-biso" intro={t("intro")} title={t("title")}>
        <SectionCopy text={t("content")} />
      </AboutSection>
      <StrategyCards />
    </>
  );
}
