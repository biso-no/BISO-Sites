"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { BookOpen, Link as LinkIcon, Megaphone, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AboutHero } from "@/components/about/about-hero";

export default function WhatIsBisoPage() {
  const t = useTranslations("about.pages.whatIsBiso");
  const tAbout = useTranslations("about");

  const strategyItems = [
    {
      key: "impact",
      icon: Megaphone,
      gradient: "from-brand-gradient-from to-brand-gradient-to",
    },
    {
      key: "connected",
      icon: LinkIcon,
      gradient: "from-brand-gradient-from to-cyan-600",
    },
    {
      key: "engaged",
      icon: Sparkles,
      gradient: "from-brand-gradient-to to-brand-gradient-from",
    },
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
        icon={<BookOpen className="h-8 w-8 text-white" />}
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

      {/* Strategy pillars */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="mb-8 text-center font-bold text-2xl text-foreground md:text-3xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <span className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to bg-clip-text text-transparent">
              {tAbout("general.strategy.subtitle")}
            </span>
          </motion.h2>
          <div className="grid gap-6 md:grid-cols-3">
            {strategyItems.map((item, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                key={item.key}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <Card className="hover:-translate-y-1 h-full p-6 transition-all duration-300 hover:shadow-lg">
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${item.gradient} shadow-md`}
                  >
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground text-lg">
                    {tAbout(`general.strategy.items.${item.key}.title`)}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {tAbout(`general.strategy.items.${item.key}.desc`)}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
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
