import { ArrowLeft, ArrowUpRight, HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about.pages.saih");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

export default async function SaihPage() {
  const [t, tCommon, tAbout] = await Promise.all([
    getTranslations("about.pages.saih"),
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

        {/* The one thing on this page a reader can act on: SAIH's own site.
            It keeps its card; the v1 version repeated `intro` inside it,
            directly under the same sentence in the hero, so that goes. */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-biso-md border border-edge p-6">
          <span className="flex items-center gap-3">
            <HeartHandshake
              aria-hidden="true"
              className="size-6 shrink-0 text-ink-accent"
            />
            <span className="type-heading-card text-ink">SAIH</span>
          </span>
          <a
            className="type-label inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-2.5 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href="https://saih.no"
            rel="noreferrer noopener"
            target="_blank"
          >
            {t("cta")}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        </div>

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
