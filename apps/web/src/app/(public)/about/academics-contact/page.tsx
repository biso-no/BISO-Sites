import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("academicsContact");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

export default async function AcademicsContactPage() {
  const [t, tCommon] = await Promise.all([
    getTranslations("academicsContact"),
    getTranslations("common"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tCommon("navigation.about"), href: "/about" },
          { label: t("title") },
        ]}
        title={t("title")}
      />

      <Section tone="paper" width="prose">
        <Prose>
          <p>{t("intro")}</p>
          <p>{t("body")}</p>
        </Prose>
      </Section>
    </>
  );
}
