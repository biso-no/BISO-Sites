import { getTranslations } from "next-intl/server";
import {
  AboutSection,
  SectionCopy,
  SubHeading,
  TitledCards,
} from "./section-shell";

const STRATEGY_KEYS = ["impact", "connected", "engaged"] as const;

/** Who BISO is, and the three strategic goals it works towards. */
export async function WhatIsBisoSection() {
  const [t, tStrategy] = await Promise.all([
    getTranslations("about.pages.whatIsBiso"),
    getTranslations("about.general.strategy"),
  ]);

  const strategy = STRATEGY_KEYS.map((key) => ({
    description: tStrategy(`items.${key}.desc`),
    id: key,
    title: tStrategy(`items.${key}.title`),
  }));

  return (
    <AboutSection id="hva-er-biso" intro={t("intro")} title={t("title")}>
      <SectionCopy text={t("content")} />
      {/* The strategy cards were their own band with a gradient-clipped
          heading and an icon tile per card; they are three titled cards in
          this section now. */}
      <SubHeading>{tStrategy("title")}</SubHeading>
      <p className="type-body mb-6 max-w-(--measure) text-ink-muted">
        {tStrategy("subtitle")}
      </p>
      <TitledCards items={strategy} />
    </AboutSection>
  );
}
