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
  Mail,
  MapPin,
  MessageSquare,
  Phone,
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
  purple: {
    gradient:
      "from-violet-50 via-violet-50/50 to-white dark:from-violet-950/30 dark:via-violet-950/10 dark:to-card",
    iconGradient: "from-violet-500 to-violet-700",
    checkColor: "text-violet-600 dark:text-violet-400",
    border: "border-violet-100 dark:border-violet-900/50",
  },
};

type BusinessPageClientProps = {
  activeCampus: string | null;
};

export function BusinessPageClient({ activeCampus }: BusinessPageClientProps) {
  const t = useTranslations("partner");

  const benefits = [
    {
      key: "colleagues",
      icon: Users,
      title: t("benefits.items.colleagues.title"),
      description: t("benefits.items.colleagues.description"),
      colorScheme: "blue" as const,
    },
    {
      key: "values",
      icon: Heart,
      title: t("benefits.items.values.title"),
      description: t("benefits.items.values.description"),
      colorScheme: "green" as const,
    },
    {
      key: "match",
      icon: Target,
      title: t("benefits.items.match.title"),
      description: t("benefits.items.match.description"),
      colorScheme: "purple" as const,
    },
  ];

  const careerDays = [
    {
      key: "oslo",
      city: "Oslo",
      title: t("careerDays.cities.oslo.title"),
      action: t("careerDays.cities.oslo.action"),
    },
    {
      key: "bergen",
      city: "Bergen",
      title: t("careerDays.cities.bergen.title"),
      action: t("careerDays.cities.bergen.action"),
    },
    {
      key: "trondheim",
      city: "Trondheim",
      title: t("careerDays.cities.trondheim.title"),
      action: t("careerDays.cities.trondheim.action"),
    },
    {
      key: "stavanger",
      city: "Stavanger",
      title: t("careerDays.cities.stavanger.title"),
      action: t("careerDays.cities.stavanger.action"),
    },
  ];

  const campuses = [
    {
      key: "oslo",
      title: t("contact.campuses.oslo.title"),
      phone: t("contact.campuses.oslo.phone"),
      email: t("contact.campuses.oslo.email"),
      address: t("contact.campuses.oslo.address"),
    },
    {
      key: "bergen",
      title: t("contact.campuses.bergen.title"),
      phone: t("contact.campuses.bergen.phone"),
      email: t("contact.campuses.bergen.email"),
      address: t("contact.campuses.bergen.address"),
    },
    {
      key: "trondheim",
      title: t("contact.campuses.trondheim.title"),
      phone: t("contact.campuses.trondheim.phone"),
      email: t("contact.campuses.trondheim.email"),
      address: t("contact.campuses.trondheim.address"),
    },
    {
      key: "stavanger",
      title: t("contact.campuses.stavanger.title"),
      phone: t("contact.campuses.stavanger.phone"),
      email: t("contact.campuses.stavanger.email"),
      address: t("contact.campuses.stavanger.address"),
    },
  ];

  const businessHotspotFeatures = [
    {
      key: "present",
      icon: Presentation,
      text: t("opportunities.businessHotspot.features.present"),
    },
    {
      key: "presentations",
      icon: Building2,
      text: t("opportunities.businessHotspot.features.presentations"),
    },
    {
      key: "talk",
      icon: MessageSquare,
      text: t("opportunities.businessHotspot.features.talk"),
    },
    {
      key: "stand",
      icon: Building2,
      text: t("opportunities.businessHotspot.features.stand"),
    },
    {
      key: "relationship",
      icon: Heart,
      text: t("opportunities.businessHotspot.features.relationship"),
    },
    {
      key: "agreements",
      icon: Handshake,
      text: t("opportunities.businessHotspot.features.agreements"),
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
            <Badge className="mb-4" variant="secondary">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              {t("hero.subtitle")}
            </Badge>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("hero.description")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
              {t("benefits.title")}
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {t("benefits.subtitle")}
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              const colors = colorSchemes[benefit.colorScheme];
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  key={benefit.key}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <Card
                    className={cn(
                      "h-full border-0 bg-linear-to-br p-6 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl",
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
                      {benefit.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {benefit.description}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Career Days Section */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <Badge className="mb-4" variant="secondary">
              <Calendar className="mr-2 h-3.5 w-3.5" />
              {t("careerDays.title")}
            </Badge>
            <h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
              {t("careerDays.title")}
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {t("careerDays.description")}
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {careerDays.map((career, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                key={career.key}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <Card className="group h-full overflow-hidden border-0 bg-card p-6 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mb-4 font-semibold text-foreground">
                    {career.title}
                  </h3>
                  <Button
                    className="w-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-lg hover:opacity-90"
                    size="sm"
                  >
                    {career.action}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Business Hotspot Section - Only for Oslo */}
      {activeCampus === "1" && (
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              className="mb-12 text-center"
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <Badge className="mb-4 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                Oslo Only
              </Badge>
              <h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
                {t("opportunities.businessHotspot.title")}
              </h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                {t("opportunities.businessHotspot.description")}
              </p>
            </motion.div>

            <div className="grid items-center gap-12 lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, x: 0 }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {businessHotspotFeatures.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <motion.div
                        className="flex items-center gap-3 rounded-xl border border-brand-border bg-brand-muted p-4 transition-all hover:bg-brand-muted-strong"
                        initial={{ opacity: 0, y: 10 }}
                        key={feature.key}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                        viewport={{ once: true }}
                        whileInView={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-gradient-from to-brand-gradient-to">
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-medium text-foreground text-sm">
                          {feature.text}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

                <motion.div
                  className="mt-8 text-center lg:text-left"
                  initial={{ opacity: 0, y: 20 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <h3 className="mb-2 font-bold text-2xl text-foreground">
                    {t("opportunities.businessHotspot.concept.title")}
                  </h3>
                  <p className="mb-6 font-semibold text-brand text-xl">
                    {t("opportunities.businessHotspot.concept.subtitle")}
                  </p>
                  <Button
                    asChild
                    className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to px-8 text-white shadow-lg hover:opacity-90"
                    size="lg"
                  >
                    <Link href="/business-hotspot">
                      {t("buttons.readMore")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </motion.div>
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
                    alt="Business Hotspot"
                    className="h-full w-full object-cover"
                    height={400}
                    src="/images/business-hotspot.png"
                    width={600}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* Contact CTA Section */}
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
              <Handshake className="mx-auto mb-4 h-12 w-12 text-white/90" />
              <h2 className="mb-4 font-bold text-2xl text-white md:text-3xl">
                {t("contact.title")}
              </h2>
              <p className="mb-6 text-white/80">{t("contact.description")}</p>
              <Button
                asChild
                className="border-white/30 bg-white/10 px-8 text-white backdrop-blur-md hover:bg-white/20"
                size="lg"
                variant="outline"
              >
                <Link href="/contact">
                  {t("buttons.contact")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            {/* Decorative elements */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
          </motion.div>
        </div>
      </section>

      {/* Contact Cards Section */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <Badge className="mb-4" variant="secondary">
              <MapPin className="mr-2 h-3.5 w-3.5" />
              Campus Contacts
            </Badge>
            <h2 className="font-bold text-2xl text-foreground md:text-3xl">
              Find Your Campus
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {campuses.map((campus, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                key={campus.key}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <Card className="group h-full border-0 bg-card p-6 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mb-4 font-semibold text-foreground text-lg">
                    {campus.title}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {campus.phone}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <Link
                        className="text-brand underline-offset-2 hover:underline"
                        href={`mailto:${campus.email}`}
                      >
                        {campus.email}
                      </Link>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {campus.address}
                      </span>
                    </div>
                  </div>
                  <Button
                    asChild
                    className="mt-6 w-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-lg hover:opacity-90"
                    size="sm"
                  >
                    <Link href={`mailto:${campus.email}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      {t("buttons.contact")}
                    </Link>
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
