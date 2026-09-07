import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";

const PRINCIPLE_KEYS = ["0", "1", "2"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("policies.drugsPolicy");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

export default async function DrugsPolicyPage() {
  const [t, tCommon, tVarsling] = await Promise.all([
    getTranslations("policies.drugsPolicy"),
    getTranslations("common"),
    getTranslations("varsling"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("title") },
        ]}
        lede={t("intro")}
        title={t("title")}
      />

      <Section tone="paper" width="prose">
        <Prose>
          <h2>{t("sections.principles.title")}</h2>
          <ul>
            {PRINCIPLE_KEYS.map((key) => (
              <li key={key}>{t(`sections.principles.items.${key}`)}</li>
            ))}
          </ul>

          <h2>{t("sections.conduct.title")}</h2>
          <p>{t("sections.conduct.body")}</p>

          <h2>{t("sections.support.title")}</h2>
          <p>{t("sections.support.body")}</p>
          {/* The support text names the reporting page in prose but carried
              no link, so the only way there was the nav. `/varsling` is a 308
              to `/safety` now, so this points at the destination directly. */}
          <p>
            <Link href="/safety">{tVarsling("title")}</Link>
          </p>
        </Prose>
      </Section>
    </>
  );
}
