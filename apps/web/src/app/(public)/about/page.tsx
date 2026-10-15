"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Mail, Users } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getOrgChartUrl, getPartners, type Partner } from "@/app/actions/about";
import { AboutHero } from "@/components/about/about-hero";
import { AlumniSaihSection } from "@/components/about/sections/alumni-saih-section";
import { DocumentsSection } from "@/components/about/sections/documents-section";
import { HistorySection } from "@/components/about/sections/history-section";
import { OperationsSection } from "@/components/about/sections/operations-section";
import { PoliticsSection } from "@/components/about/sections/politics-section";
import { AboutSectionNav } from "@/components/about/sections/section-nav";
import { StudyQualitySection } from "@/components/about/sections/study-quality-section";
import { WhatIsBisoSection } from "@/components/about/sections/what-is-biso-section";
import { WhatWeDoSection } from "@/components/about/sections/what-we-do-section";
import { Partners } from "@/components/home/partners";

/**
 * Om BISO on one page. The former subpages (what is BISO, politics, study
 * quality, history, operations, alumni, SAIH, bylaws) are sections here;
 * their old addresses redirect to the matching anchor.
 */
export default function AboutPage() {
  const t = useTranslations("about");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [orgChartUrl, setOrgChartUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getPartners();
        const orgChartLink = await getOrgChartUrl();
        setPartners(res);
        setOrgChartUrl(orgChartLink);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: t("hub.title") }]}
        icon={<Users className="h-8 w-8 text-white" />}
        subtitle={t("hub.subtitle")}
        title={t("hub.title")}
      />
      <AboutSectionNav />

      <WhatIsBisoSection />
      <WhatWeDoSection />
      <StudyQualitySection />
      <PoliticsSection />
      <HistorySection />
      <OperationsSection />
      <AlumniSaihSection />
      <DocumentsSection />

      {orgChartUrl && (
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <h2 className="mb-8 font-bold text-2xl text-foreground md:text-3xl">
                {t("general.orgChart.title")}
              </h2>
              <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg">
                <Image
                  alt="BISO organizational chart"
                  className="h-auto w-full"
                  height={900}
                  src={orgChartUrl}
                  width={1600}
                />
              </div>
            </motion.div>
          </div>
        </section>
      )}

      <Partners partners={partners} />

      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative overflow-hidden rounded-2xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to p-8 text-center shadow-2xl md:p-12"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="relative z-10">
              <Mail className="mx-auto mb-4 h-12 w-12 text-white/90" />
              <h2 className="mb-4 font-bold text-2xl text-white md:text-3xl">
                {t("general.contact.title")}
              </h2>
              <p className="mb-6 text-white/80">
                {t("general.contact.subtitle")}
              </p>
              <Button
                asChild
                className="border-white/30 bg-white/10 px-8 text-white backdrop-blur-md hover:bg-white/20"
                size="lg"
                variant="outline"
              >
                <Link href="/campus">{t("general.contact.campusCta")}</Link>
              </Button>
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
          </motion.div>
        </div>
      </section>
    </div>
  );
}
