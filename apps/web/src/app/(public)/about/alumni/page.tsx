"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowRight, Users } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AboutHero } from "@/components/about/about-hero";

export default function AboutAlumniPage() {
  const t = useTranslations("about.pages.alumni");
  const tAbout = useTranslations("about");

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: tAbout("hub.title"), href: "/about" },
          { label: t("title") },
        ]}
        compact
        icon={<Users className="h-8 w-8 text-white" />}
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
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("content")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Card */}
      <section className="py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <Card className="overflow-hidden">
              <div className="flex flex-col items-center justify-between gap-6 bg-linear-to-r from-brand-gradient-from/10 to-brand-gradient-to/10 p-8 md:flex-row">
                <div>
                  <h3 className="mb-2 font-semibold text-foreground text-xl">
                    {t("title")}
                  </h3>
                  <p className="text-muted-foreground">{t("intro")}</p>
                </div>
                <Button
                  asChild
                  className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-lg hover:opacity-90"
                  size="lg"
                >
                  <Link href="/alumni">
                    {t("cta")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          </motion.div>
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
