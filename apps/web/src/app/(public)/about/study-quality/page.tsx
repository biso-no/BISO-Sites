"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AboutHero } from "@/components/about/about-hero";

export default function StudyQualityPage() {
  const t = useTranslations("about.pages.studyQuality");
  const tAbout = useTranslations("about");

  const academicItems = [
    tAbout("general.academics.items.0"),
    tAbout("general.academics.items.1"),
    tAbout("general.academics.items.2"),
    tAbout("general.academics.items.3"),
    tAbout("general.academics.items.4"),
  ];

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: tAbout("hub.title"), href: "/about" },
          { label: t("title") },
        ]}
        compact
        icon={<GraduationCap className="h-8 w-8 text-white" />}
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

      {/* What we focus on */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <Card className="p-8">
              <h2 className="mb-6 font-semibold text-foreground text-xl">
                {tAbout("general.academics.subtitle")}
              </h2>
              <ul className="space-y-4">
                {academicItems.map((item, index) => (
                  <motion.li
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    key={index}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    viewport={{ once: true }}
                    whileInView={{ opacity: 1, x: 0 }}
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                    <span className="text-muted-foreground">{item}</span>
                  </motion.li>
                ))}
              </ul>
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
            <Button asChild variant="outline" size="lg">
              <Link href="/about">← {tAbout("hub.title")}</Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
