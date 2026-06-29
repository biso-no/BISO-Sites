"use client";

import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  HelpCircle,
  Shield,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AboutHero } from "@/components/about/about-hero";
import { VarslingForm } from "@/components/safety/varsling-form";
import { SectionHeading } from "@/components/shared/section-heading";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  viewport: { once: true },
  whileInView: { opacity: 1, y: 0 },
} as const;

const INFO_CARDS = [
  {
    key: "harassment",
    icon: AlertTriangle,
    gradient: "from-amber-500 to-orange-500",
  },
  { key: "witness", icon: Eye, gradient: "from-blue-500 to-cyan-500" },
  { key: "other", icon: HelpCircle, gradient: "from-purple-500 to-pink-500" },
] as const;

const RULE_KEYS = [
  "rules.0",
  "rules.1",
  "rules.2",
  "rules.3",
  "rules.4",
] as const;
const CONTACT_KEYS = ["contacts.0", "contacts.1", "contacts.2"] as const;
const PRIVACY_KEYS = ["points.0", "points.1", "points.2", "points.3"] as const;

export default function SafetyPage() {
  const t = useTranslations("varsling");
  const tNav = useTranslations("common.navigation");

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: tNav("links.safety") },
        ]}
        icon={<Shield className="h-8 w-8 text-white" />}
        subtitle={t("subtitle")}
        title={t("title")}
      />

      {/* Intro + categories */}
      <section className="relative overflow-hidden py-16" id="about-content">
        <div className="pointer-events-none absolute inset-0 bg-grid-primary-soft opacity-50" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.p
            className="mx-auto max-w-3xl text-center text-lg text-muted-foreground leading-relaxed"
            transition={{ duration: 0.6 }}
            {...fadeUp}
          >
            {t("description")}
          </motion.p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {INFO_CARDS.map((card, index) => (
              <motion.div
                key={card.key}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                {...fadeUp}
              >
                <Card className="group h-full border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${card.gradient} shadow-md transition-transform duration-300 group-hover:scale-110`}
                  >
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground">
                    {t(`infoCards.${card.key}.title`)}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(`infoCards.${card.key}.description`)}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Reporting form */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-8"
            transition={{ duration: 0.6 }}
            {...fadeUp}
          >
            <SectionHeading
              align="center"
              gradient
              subtitle={t("form.description")}
              title={t("form.title")}
            />
          </motion.div>
          <motion.div transition={{ duration: 0.6 }} {...fadeUp}>
            <div className="glass-panel p-6 sm:p-8">
              <VarslingForm />
            </div>
          </motion.div>
        </div>
      </section>

      {/* What is whistleblowing */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div transition={{ duration: 0.6 }} {...fadeUp}>
            <SectionHeading title={t("whatIsWhistleblowing.title")} />
            <p className="mt-6 whitespace-pre-line text-muted-foreground leading-relaxed">
              {t("whatIsWhistleblowing.content")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Code of conduct */}
      <section className="bg-section/50 py-16" id="code-of-conduct">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div transition={{ duration: 0.6 }} {...fadeUp}>
            <SectionHeading title={t("codeOfConduct.title")} />
            <p className="mt-6 text-muted-foreground leading-relaxed">
              {t("codeOfConduct.purpose")}
            </p>
          </motion.div>
          <ul className="mt-6 space-y-3">
            {RULE_KEYS.map((key, index) => (
              <motion.li
                className="flex items-start gap-3"
                key={key}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                {...fadeUp}
              >
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <span className="text-muted-foreground">
                  {t(`codeOfConduct.${key}`)}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* Anonymous report callout */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div transition={{ duration: 0.6 }} {...fadeUp}>
            <Card className="overflow-hidden border-brand-accent/40 bg-brand-accent-muted">
              <CardContent className="space-y-3 p-6 sm:p-8">
                <h3 className="flex items-center gap-2 font-semibold text-foreground text-lg">
                  <AlertTriangle className="h-5 w-5 text-brand-accent" />
                  {t("anonymousReport.title")}
                </h3>
                <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                  {t("anonymousReport.content")}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Sending report */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div transition={{ duration: 0.6 }} {...fadeUp}>
            <SectionHeading title={t("sendingReport.title")} />
            <p className="mt-6 whitespace-pre-line text-muted-foreground leading-relaxed">
              {t("sendingReport.content")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-8"
            transition={{ duration: 0.6 }}
            {...fadeUp}
          >
            <SectionHeading
              subtitle={t("contact.description")}
              title={t("contact.title")}
            />
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-3">
            {CONTACT_KEYS.map((key, index) => (
              <motion.div
                key={key}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                {...fadeUp}
              >
                <Card className="group h-full border-border/50 bg-card/80 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md transition-transform duration-300 group-hover:scale-110">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="font-semibold text-foreground">
                    {t(`contact.${key}.role`)}
                  </div>
                  <a
                    className="mt-1 inline-block text-brand text-sm underline-offset-2 hover:underline"
                    href={`mailto:${t(`contact.${key}.email`)}`}
                  >
                    {t(`contact.${key}.email`)}
                  </a>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy notice */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div transition={{ duration: 0.6 }} {...fadeUp}>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="space-y-4 p-6 sm:p-8">
                <h3 className="flex items-center gap-2 font-semibold text-foreground text-lg">
                  <Shield className="h-5 w-5 text-brand" />
                  {t("privacy.title")}
                </h3>
                <div className="space-y-3 text-muted-foreground text-sm">
                  {PRIVACY_KEYS.map((key, index) => (
                    <div className="flex items-start gap-3" key={key}>
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      <p>
                        {index === 3 ? (
                          <>
                            {
                              t(`privacy.${key}`).split(
                                "personvernerklæring"
                              )[0]
                            }
                            <Link
                              className="text-brand hover:underline"
                              href={t("privacy.privacyLink")}
                            >
                              {t(`privacy.${key}`).includes(
                                "personvernerklæring"
                              )
                                ? "personvernerklæring"
                                : "privacy policy"}
                            </Link>
                            {t(`privacy.${key}`).split(
                              "personvernerklæring"
                            )[1] ||
                              t(`privacy.${key}`).split("privacy policy")[1]}
                          </>
                        ) : (
                          t(`privacy.${key}`)
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
