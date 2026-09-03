import { ArrowLeft, Link as LinkIcon, Megaphone, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const STRATEGY = [
  { key: "impact", Icon: Megaphone },
  { key: "connected", Icon: LinkIcon },
  { key: "engaged", Icon: Sparkles },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about.pages.whatIsBiso");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

export default async function WhatIsBisoPage() {
  const [t, tCommon, tAbout] = await Promise.all([
    getTranslations("about.pages.whatIsBiso"),
    getTranslations("common"),
    getTranslations("about"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tAbout("hub.title"), href: "/about" },
          { label: t("title") },
        ]}
        lede={t("intro")}
        title={t("title")}
      />

      <Section id="about-content" tone="paper" width="prose">
        <Prose>
          <p className="whitespace-pre-line">{t("content")}</p>
        </Prose>
      </Section>

      <Section className="border-edge border-t" tone="paper">
        {/* The gradient-clipped text is gone: `bg-clip-text text-transparent`
            over a two-stop gradient is the one place in the old design where a
            heading's contrast could not be measured, because it has no single
            colour. */}
        <SectionHeading>{tAbout("general.strategy.subtitle")}</SectionHeading>
        <CardGrid columns={3}>
          {STRATEGY.map(({ key, Icon }) => (
            <li key={key}>
              <div className="flex h-full flex-col rounded-biso-md border border-edge p-6">
                <Icon aria-hidden="true" className="size-6 text-ink-accent" />
                <h3 className="type-heading-card mt-4 text-ink">
                  {tAbout(`general.strategy.items.${key}.title`)}
                </h3>
                <p className="type-body-sm mt-2 text-ink-muted">
                  {tAbout(`general.strategy.items.${key}.desc`)}
                </p>
              </div>
            </li>
          ))}
        </CardGrid>

        <Link
          className="mt-12 inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          href="/about"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          <span className="type-label">{tAbout("hub.title")}</span>
        </Link>
      </Section>
    </>
  );
}
