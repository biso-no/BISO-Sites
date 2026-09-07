import { Download, Mail } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const PRESS_EMAIL = "contact@biso.no";

/**
 * The three brand assets offered for download. Files, not rows — they live in
 * `public/images/`, so the list is static by nature.
 */
const ASSETS = [
  { key: "logoLight", href: "/images/logo-light.png" },
  { key: "logoDark", href: "/images/logo-dark.png" },
  { key: "orgChart", href: "/images/org-chart.png" },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("press.meta");
  return { title: t("title"), description: t("description") };
}

export default async function PressPage() {
  const [t, tCommon] = await Promise.all([
    getTranslations("press"),
    getTranslations("common"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("title") },
        ]}
        lede={t("contact.body")}
        title={t("title")}
      />

      <Section tone="paper">
        <SectionHeading>{t("contact.title")}</SectionHeading>
        <a
          className="type-heading-card inline-flex items-center gap-3 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          href={`mailto:${PRESS_EMAIL}`}
        >
          <Mail aria-hidden="true" className="size-5 shrink-0" />
          <span className="min-w-0 break-words">{PRESS_EMAIL}</span>
        </a>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        <SectionHeading>{t("assets.title")}</SectionHeading>
        <ul className="flex flex-col gap-3">
          {ASSETS.map(({ key, href }) => (
            <li key={key}>
              <a
                className="type-body group inline-flex items-center gap-3 text-ink underline underline-offset-4 hover:text-ink-accent hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                download
                href={href}
              >
                <Download
                  aria-hidden="true"
                  className="size-4 shrink-0 text-ink-muted group-hover:text-ink-accent"
                />
                <span className="min-w-0 break-words">
                  {t(`assets.${key}`)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("usage.title")}</SectionHeading>
        <Prose>
          <p>{t("usage.body")}</p>
        </Prose>
      </Section>
    </>
  );
}
