"use client";

import { useTranslations } from "next-intl";
import { AboutSection, SectionCopy } from "./section-shell";

export function OperationsSection() {
  const t = useTranslations("about.pages.operations");
  return (
    <AboutSection id="drift" intro={t("intro")} muted title={t("title")}>
      <SectionCopy text={t("content")} />
    </AboutSection>
  );
}
