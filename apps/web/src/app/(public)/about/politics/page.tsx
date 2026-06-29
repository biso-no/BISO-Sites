"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Landmark, Users } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AboutHero } from "@/components/about/about-hero";
import { ForumList } from "@/components/about/forum-list";
import { PdfCta } from "@/components/about/pdf-cta";
import { PolicyCards } from "@/components/about/policy-cards";

interface CardItem {
  description: string;
  id: string;
  title: string;
}

export default function PoliticsPage() {
  const t = useTranslations("about.pages.politics");
  const tAbout = useTranslations("about");

  const policyDemands = t.raw("policyDemands") as CardItem[];
  const forums = t.raw("forums") as CardItem[];

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: tAbout("hub.title"), href: "/about" },
          { label: t("title") },
        ]}
        compact
        icon={<Landmark className="h-8 w-8 text-white" />}
        subtitle={t("intro")}
        title={t("title")}
      />

      {/* Main content */}
      <section className="py-16" id="about-content">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="prose prose-lg max-w-none"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <p className="whitespace-pre-line text-lg text-muted-foreground leading-relaxed">
              {t("content")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Policy demands */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="mb-8 font-bold text-2xl text-foreground md:text-3xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            {t("policyDemandsTitle")}
          </motion.h2>
          <PolicyCards items={policyDemands} />
        </div>
      </section>

      {/* Forums */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="mb-8 font-bold text-2xl text-foreground md:text-3xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            {t("forumsTitle")}
          </motion.h2>
          <ForumList items={forums} />
        </div>
      </section>

      {/* SPU CTA */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <Card className="flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">
                    {t("spu.title")}
                  </h3>
                  <p className="mt-1 text-muted-foreground">
                    {t("spu.description")}
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="shrink-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md hover:opacity-90"
                size="lg"
              >
                <Link href="/contact">{t("spu.cta")}</Link>
              </Button>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Policy document */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PdfCta
            description={t("policyPdf.description")}
            href={t("policyPdf.href")}
            title={t("policyPdf.title")}
          />
        </div>
      </section>

      {/* Back to about */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <Button asChild size="lg" variant="outline">
              <Link href="/about">← {tAbout("hub.title")}</Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
