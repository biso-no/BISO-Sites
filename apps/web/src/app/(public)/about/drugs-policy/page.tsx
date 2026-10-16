import { ArrowLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

const PRINCIPLE_KEYS = ["0", "1", "2"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("policies.drugsPolicy");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

/**
 * The drug and alcohol policy, under Om BISO. It moved here from
 * `/policies/drugs-policy`, which now 308s to this address. The signed policy
 * itself is published under code of conduct on /documents, which the primary
 * action opens.
 */
export default async function DrugsPolicyPage() {
  const [t, tCommon, tAbout, tVarsling] = await Promise.all([
    getTranslations("policies.drugsPolicy"),
    getTranslations("common"),
    getTranslations("about"),
    getTranslations("varsling"),
  ]);

  return (
    <>
      <PageHeader
        actions={
          <>
            <Link
              className={statusPanelPrimaryAction}
              href="/documents?category=code-of-conduct"
            >
              <FileText aria-hidden="true" className="size-4 shrink-0" />
              {tAbout("documents.items.conduct.title")}
            </Link>
            <Link
              className={statusPanelSecondaryAction}
              href="/about#dokumenter"
            >
              <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
              {tAbout("hub.title")}
            </Link>
          </>
        }
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tAbout("hub.title"), href: "/about" },
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
              no link. `/varsling` is a 308 to `/safety`, so this points at
              the destination directly. */}
          <p>
            <Link href="/safety">{tVarsling("title")}</Link>
          </p>
        </Prose>
      </Section>
    </>
  );
}
