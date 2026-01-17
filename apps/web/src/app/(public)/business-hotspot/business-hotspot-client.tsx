"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import {
  ArrowRight,
  Building2,
  Calendar,
  Handshake,
  Heart,
  MessageSquare,
  Presentation,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

// Color schemes matching the rest of the app
const colorSchemes = {
  blue: {
    gradient:
      "from-blue-50 via-blue-50/50 to-white dark:from-blue-950/30 dark:via-blue-950/10 dark:to-card",
    iconGradient: "from-blue-500 to-blue-700",
    checkColor: "text-blue-600 dark:text-blue-400",
    border: "border-blue-100 dark:border-blue-900/50",
  },
  green: {
    gradient:
      "from-emerald-50 via-emerald-50/50 to-white dark:from-emerald-950/30 dark:via-emerald-950/10 dark:to-card",
    iconGradient: "from-emerald-500 to-emerald-700",
    checkColor: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-100 dark:border-emerald-900/50",
  },
  orange: {
    gradient:
      "from-orange-50 via-orange-50/50 to-white dark:from-orange-950/30 dark:via-orange-950/10 dark:to-card",
    iconGradient: "from-orange-500 to-amber-600",
    checkColor: "text-orange-600 dark:text-orange-400",
    border: "border-orange-100 dark:border-orange-900/50",
  },
};

export function BusinessHotspotClient() {
  const t = useTranslations("businessHotspot");

  const features = [
    {
      key: "presence",
      icon: Building2,
      title: t("features.0"),
      description: t("featureDescriptions.0"),
      colorScheme: "blue" as const,
    },
    {
      key: "talks",
      icon: Presentation,
      title: t("features.1"),
      description: t("featureDescriptions.1"),
      colorScheme: "green" as const,
    },
    {
      key: "branding",
      icon: Heart,
      title: t("features.2"),
      description: t("featureDescriptions.2"),
      colorScheme: "orange" as const,
    },
  ];

  const benefits = [
    {
      icon: Users,
      text: t("benefits.access"),
    },
    {
      icon: Target,
      text: t("benefits.recruitment"),
    },
    {
      icon: Calendar,
      text: t("benefits.booking"),
    },
    {
      icon: MessageSquare,
      text: t("benefits.engage"),
    },
    {
      icon: Handshake,
      text: t("benefits.partnership"),
    },
    {
      icon: Sparkles,
      text: t("benefits.visibility"),
    },
  ];

  return (
    <>
      {/* Introduction Section */}
      <section className="py-16" id="about-content">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <Badge className="mb-4 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              {t("badge")}
            </Badge>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("intro")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* What is Business Hotspot */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              <div className="mb-4 inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
                {t("whatIs.label")}
              </div>
              <h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
                {t("whatIs.title")}
              </h2>
              <p className="mb-6 text-muted-foreground leading-relaxed">
                {t("whatIs.description")}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit, index) => {
                  const Icon = benefit.icon;
                  return (
                    <motion.li
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      key={index}
                      transition={{ delay: index * 0.1, duration: 0.3 }}
                      viewport={{ once: true }}
                      whileInView={{ opacity: 1, x: 0 }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-gradient-from to-brand-gradient-to">
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-muted-foreground text-sm">
                        {benefit.text}
                      </span>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-linear-to-br from-brand-gradient-from/20 to-brand-gradient-to/20 shadow-2xl">
                <Image
                  alt="Business Hotspot at Campus Oslo"
                  className="h-full w-full object-cover"
                  height={400}
                  src="/images/business-hotspot.png"
                  width={600}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
              </div>
              <div className="-bottom-4 -right-4 absolute rounded-xl border border-border bg-card p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                    <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      Campus Oslo
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Nydalsveien 37
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
              {t("whatYouCanDo.title")}
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {t("whatYouCanDo.description")}
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const colors = colorSchemes[feature.colorScheme];
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  key={feature.key}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <Card
                    className={cn(
                      "hover:-translate-y-1 h-full border-0 bg-linear-to-br p-6 shadow-lg transition-all hover:shadow-xl",
                      colors.gradient,
                      colors.border
                    )}
                  >
                    <div
                      className={cn(
                        "mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br shadow-md",
                        colors.iconGradient
                      )}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="mb-2 font-semibold text-foreground text-lg">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative overflow-hidden rounded-2xl bg-linear-to-br from-orange-500 to-amber-600 p-8 text-center shadow-2xl md:p-12"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="relative z-10">
              <Handshake className="mx-auto mb-4 h-12 w-12 text-white/90" />
              <h2 className="mb-4 font-bold text-2xl text-white md:text-3xl">
                {t("ctaSection.title")}
              </h2>
              <p className="mb-6 text-white/80">
                {t("ctaSection.description")}
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  asChild
                  className="bg-white px-8 text-orange-600 shadow-lg hover:bg-white/90"
                  size="lg"
                >
                  <Link href="/business">
                    {t("cta")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  className="border-white/30 bg-white/10 px-8 text-white backdrop-blur-md hover:bg-white/20"
                  size="lg"
                  variant="outline"
                >
                  <Link href="mailto:business.oslo@biso.no">
                    {t("ctaSection.contactTeam")}
                  </Link>
                </Button>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          </motion.div>
        </div>
      </section>
    </>
  );
}
