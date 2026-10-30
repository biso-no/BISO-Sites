import { getTranslations } from "next-intl/server";
import { CtaCard, PdfLink } from "./cta-card";
import {
  AboutSection,
  ForumList,
  SectionCopy,
  SubHeading,
  TitledCards,
} from "./section-shell";

interface CardItem {
  description: string;
  id: string;
  title: string;
}

/** Political independence, the demands BISO makes, and where it makes them. */
export async function PoliticsSection() {
  const t = await getTranslations("about.pages.politics");
  const demands = t.raw("policyDemands") as CardItem[];
  const forums = t.raw("forums") as CardItem[];

  return (
    <AboutSection id="politikk" intro={t("intro")} title={t("title")}>
      <SectionCopy text={t("content")} />

      <SubHeading>{t("policyDemandsTitle")}</SubHeading>
      <TitledCards columns={2} items={demands} />

      <SubHeading>{t("forumsTitle")}</SubHeading>
      <ForumList items={forums} />

      <CtaCard
        cta={t("spu.cta")}
        description={t("spu.description")}
        href="/units/oslo/spu-studentpolitisk-utvalg"
        title={t("spu.title")}
      />
      <PdfLink
        description={t("policyPdf.description")}
        href={t("policyPdf.href")}
        title={t("policyPdf.title")}
      />
    </AboutSection>
  );
}
