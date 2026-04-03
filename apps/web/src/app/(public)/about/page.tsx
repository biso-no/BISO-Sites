"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Mail,
  Rocket,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getOrgChartUrl, getPartners, type Partner } from "@/app/actions/about";
import { AboutHero } from "@/components/about/about-hero";
import { StrategyCards } from "@/components/about/strategy-cards";
import { TopicGrid } from "@/components/about/topic-grid";
import { Partners } from "@/components/home/partners";

export default function AboutPage() {
  const t = useTranslations("about");
  const tHome = useTranslations("home");
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

  const whatWeDoItems = [
    t("general.whatWeDo.items.0"),
    t("general.whatWeDo.items.1"),
    t("general.whatWeDo.items.2"),
    t("general.whatWeDo.items.3"),
    t("general.whatWeDo.items.4"),
  ];

  const academicItems = [
    t("general.academics.items.0"),
    t("general.academics.items.1"),
    t("general.academics.items.2"),
    t("general.academics.items.3"),
    t("general.academics.items.4"),
  ];

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      {/* Hero */}
      <AboutHero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: t("hub.title") }]}
        icon={<Users className="h-8 w-8 text-white" />}
        subtitle={t("hub.subtitle")}
        title={t("hub.title")}
      />

      {/* Intro section */}
      <section className="py-16" id="about-content">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.p
            className="text-lg text-muted-foreground leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            {t("hub.description")}
          </motion.p>
        </div>
      </section>

      {/* Strategy Cards */}
      <StrategyCards />

      {/* What We Do Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              <div className="mb-4 inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
                {t("general.whatWeDo.title")}
              </div>
              <h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
                {t("general.whatWeDo.subtitle")}
              </h2>
              <p className="mb-6 text-muted-foreground leading-relaxed">
                {t("general.whatWeDo.lead")}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {whatWeDoItems.map((item, index) => (
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
            </motion.div>

            {/* Stats Cards */}
            <motion.div
              className="grid gap-4 sm:grid-cols-2"
              initial={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              {[
                {
                  icon: Calendar,
                  label: tHome("about.upcomingEvents"),
                  gradient: "from-blue-500 to-cyan-500",
                },
                {
                  icon: Briefcase,
                  label: tHome("about.jobOpportunities"),
                  gradient: "from-purple-500 to-pink-500",
                },
                {
                  icon: Rocket,
                  label: tHome("about.studentGroups"),
                  gradient: "from-amber-500 to-orange-500",
                },
                {
                  icon: GraduationCap,
                  label: t("general.academics.title"),
                  gradient: "from-emerald-500 to-teal-500",
                },
              ].map((stat, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  key={stat.label}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  <Card className="group p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div
                      className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${stat.gradient} shadow-md`}
                    >
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                    <p className="font-medium text-muted-foreground text-sm">
                      {stat.label}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Academics Section */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Image placeholder */}
            <motion.div
              className="order-2 lg:order-1"
              initial={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-linear-to-br from-brand-gradient-from/20 to-brand-gradient-to/20 shadow-2xl">
                <div className="absolute inset-0 flex items-center justify-center">
                  <GraduationCap className="h-24 w-24 text-brand/30" />
                </div>
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              className="order-1 lg:order-2"
              initial={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              <div className="mb-4 inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
                {t("general.academics.title")}
              </div>
              <h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
                {t("general.academics.subtitle")}
              </h2>
              <p className="mb-6 text-muted-foreground leading-relaxed">
                {t("general.academics.lead")}
              </p>
              <ul className="space-y-3">
                {academicItems.map((item, index) => (
                  <motion.li
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: 10 }}
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* Politics CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
              {t("general.politics.title")}
            </h2>
            <p className="mb-6 text-muted-foreground leading-relaxed">
              {t("general.politics.lead")}
            </p>
            <Button
              asChild
              className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to px-8 text-white shadow-lg hover:opacity-90"
              size="lg"
            >
              <Link href="/about/politics">{t("general.politics.cta")}</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Topic Grid */}
      <TopicGrid />

      {/* Org Chart */}
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

      {/* Contact CTA */}
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
            {/* Decorative elements */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
          </motion.div>
        </div>
      </section>
    </div>
  );
}
