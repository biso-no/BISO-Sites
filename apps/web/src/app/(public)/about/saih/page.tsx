"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowUpRight, HeartHandshake } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AboutHero } from "@/components/about/about-hero";

export default function SAIHPage() {
  const t = useTranslations("about.pages.saih");
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
        icon={<HeartHandshake className="h-8 w-8 text-white" />}
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
              <div className="flex flex-col items-center justify-between gap-6 bg-linear-to-r from-pink-500/10 to-rose-500/10 p-8 md:flex-row">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-pink-500 to-rose-500 shadow-md">
                    <HeartHandshake className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">
                      SAIH
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {t("intro")}
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  className="bg-linear-to-r from-pink-500 to-rose-500 text-white shadow-lg hover:opacity-90"
                  size="lg"
                >
                  <a href="https://saih.no" rel="noreferrer" target="_blank">
                    {t("cta")}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </a>
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
