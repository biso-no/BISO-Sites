import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getOrgChartUrl, getPartners } from "@/app/actions/about";
import { AlumniSaihSection } from "@/components/about/sections/alumni-saih-section";
import { DocumentsSection } from "@/components/about/sections/documents-section";
import { HistorySection } from "@/components/about/sections/history-section";
import { OperationsSection } from "@/components/about/sections/operations-section";
import { PoliticsSection } from "@/components/about/sections/politics-section";
import { AboutSectionNav } from "@/components/about/sections/section-nav";
import { StudyQualitySection } from "@/components/about/sections/study-quality-section";
import { WhatIsBisoSection } from "@/components/about/sections/what-is-biso-section";
import { WhatWeDoSection } from "@/components/about/sections/what-we-do-section";
import { PartnerGrid } from "@/components/home/v2/partner-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: `${t("hub.title")} | BISO`, description: t("hub.subtitle") };
}

/**
 * Om BISO on one page (Branding Committee, batch D). The former subpages —
 * what BISO is, study quality, politics, history, operations, alumni and
 * SAIH — are sections here, in `ABOUT_SECTIONS` order, and their old
 * addresses 308 to the matching anchor (`about/<slug>/route.ts`). The bylaws
 * address opens the bylaws shelf on /documents.
 *
 * Laid out as the content template (spec §4.5): the section menu is the
 * "On this page" rail, the sections are the column beside it. Partners and the
 * org chart are fetched here on the server; the merged page loaded both in a
 * `useEffect`, so it shipped without them and filled in after hydration.
 */
export default async function AboutPage() {
  const [t, tCommon, partners, orgChartUrl] = await Promise.all([
    getTranslations("about"),
    getTranslations("common"),
    getPartners(),
    getOrgChartUrl(),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("hub.title") },
        ]}
        lede={t("hub.subtitle")}
        title={t("hub.title")}
      />

      <Section as="div" tone="paper">
        {/* A grid only from `lg`: a sticky grid item can move only within its
            own cell, and in a one-column grid the menu's cell is just the
            menu, so below `lg` it scrolled away instead of sticking. In
            block flow its containing block is this wrapper — every section. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16">
          <AboutSectionNav />
          <div className="min-w-0">
            <WhatIsBisoSection />
            <WhatWeDoSection />
            <StudyQualitySection />
            <PoliticsSection />
            <HistorySection />
            <OperationsSection />
            <AlumniSaihSection />
            <DocumentsSection />
          </div>
        </div>
      </Section>

      {orgChartUrl ? (
        <Section className="border-edge border-t" tone="paper">
          <SectionHeading>{t("general.orgChart.title")}</SectionHeading>
          {/* A diagram, not a photo: it keeps its corners (no chevron crop)
              and a light ground in both themes so its labels stay legible. */}
          <figure className="overflow-hidden rounded-biso-md border border-edge bg-paper">
            <Image
              alt={t("general.orgChart.title")}
              className="h-auto w-full"
              height={900}
              sizes="(max-width: 1200px) 100vw, 1200px"
              src={orgChartUrl}
              width={1600}
            />
          </figure>
        </Section>
      ) : null}

      <PartnerGrid partners={partners} title={t("general.partners.title")} />

      <Section className="border-edge border-t" tone="paper" width="prose">
        <SectionHeading>{t("general.contact.title")}</SectionHeading>
        <p className="type-body text-ink-muted">
          {t("general.contact.subtitle")}
        </p>
        <p className="mt-6">
          <Link className={statusPanelPrimaryAction} href="/campus">
            {t("general.contact.campusCta")}
          </Link>
        </p>
      </Section>
    </>
  );
}
