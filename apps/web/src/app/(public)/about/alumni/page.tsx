import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about.pages.alumni");
  return { title: `${t("title")} | BISO`, description: t("intro") };
}

export default async function AboutAlumniPage() {
  const [t, tCommon, tAbout] = await Promise.all([
    getTranslations("about.pages.alumni"),
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
          <p>{t("content")}</p>
        </Prose>

        {/* PLACEHOLDER-008: the `cta` copy reads "Go to Alumni site", so this
            was always meant to link to an external alumni site. It pointed at
            `/alumni`, which is not a route in this app and returned 404. No
            alumni URL exists anywhere in the repo, so no button is rendered
            rather than one pointing somewhere invented. The v1 page also
            repeated the title and intro in a card below the same intro; that
            duplication goes with it. Restore a real link here once the URL is
            known. */}

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
