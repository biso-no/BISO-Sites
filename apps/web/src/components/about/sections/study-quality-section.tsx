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

const FOCUS_KEYS = ["0", "1", "2", "3", "4"] as const;

/** Your voice in academia: focus areas, wins, forums, how to raise a case. */
export async function StudyQualitySection() {
  const [t, tAbout] = await Promise.all([
    getTranslations("about.pages.studyQuality"),
    getTranslations("about"),
  ]);
  const wins = t.raw("wins") as CardItem[];
  const forums = t.raw("forums") as CardItem[];

  return (
    <AboutSection
      eyebrow={tAbout("general.academics.title")}
      id="studiekvalitet"
      intro={t("intro")}
      title={t("title")}
    >
      <SectionCopy text={t("content")} />

      <SubHeading>{tAbout("general.academics.subtitle")}</SubHeading>
      <ul className="type-body max-w-(--measure) list-disc space-y-2 ps-5 text-ink">
        {FOCUS_KEYS.map((key) => (
          <li key={key}>{tAbout(`general.academics.items.${key}`)}</li>
        ))}
      </ul>

      <SubHeading>{t("winsTitle")}</SubHeading>
      <TitledCards items={wins} />

      <SubHeading>{t("forumsTitle")}</SubHeading>
      <ForumList items={forums} />

      <CtaCard
        cta={t("yourCase.cta")}
        description={t("yourCase.description")}
        href="/contact"
        title={t("yourCase.title")}
      />
      <PdfLink
        description={t("targetDoc.description")}
        href={t("targetDoc.href")}
        title={t("targetDoc.title")}
      />
    </AboutSection>
  );
}
