"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Building2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AboutHero } from "@/components/about/about-hero";

export default function OperationsPage() {
  const t = useTranslations("about.pages.operations");
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
        icon={<Building2 className="h-8 w-8 text-white" />}
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
