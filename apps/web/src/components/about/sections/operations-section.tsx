import { getTranslations } from "next-intl/server";
import { AboutSection, SectionCopy } from "./section-shell";

export async function OperationsSection() {
  const t = await getTranslations("about.pages.operations");
  return (
    <AboutSection id="drift" intro={t("intro")} title={t("title")}>
      <SectionCopy text={t("content")} />
    </AboutSection>
  );
}
