"use client";

import { Card } from "@repo/ui/components/ui/card";
import {
  ArrowRight,
  ExternalLink,
  Gavel,
  Globe,
  GraduationCap,
  Landmark,
  LayoutGrid,
  PiggyBank,
  ShieldAlert,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AboutHero } from "@/components/about/about-hero";

const internalLinks = [
  {
    key: "biFond",
    href: "/bi-fondet",
    icon: PiggyBank,
    gradient: "from-green-500 to-emerald-600",
  },
  {
    key: "studyQuality",
    href: "/about/study-quality",
    icon: GraduationCap,
    gradient: "from-rose-500 to-red-500",
  },
  {
    key: "politics",
    href: "/about/politics",
    icon: Landmark,
    gradient: "from-purple-500 to-pink-500",
  },
  {
    key: "safety",
    href: "/safety",
    icon: ShieldAlert,
    gradient: "from-slate-500 to-zinc-500",
  },
  {
    key: "bylaws",
    href: "/about/bylaws",
    icon: Gavel,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    key: "alumni",
    href: "/about/alumni",
    icon: Users,
    gradient: "from-cyan-500 to-blue-500",
  },
] as const;

const externalLinks = [
  { key: "bi", href: "https://www.bi.no" },
  { key: "velferdstinget", href: "https://velferdstinget.no" },
  { key: "nso", href: "https://www.student.no" },
] as const;

export default function ResourcesPage() {
  const t = useTranslations("resources");

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: t("hero.title") }]}
        compact
        icon={<LayoutGrid className="h-8 w-8 text-white" />}
        subtitle={t("hero.subtitle")}
        title={t("hero.title")}
      />

      {/* Internal resource links */}
      <section className="py-16" id="about-content">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="mb-8 font-bold text-2xl text-foreground md:text-3xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            {t("sections.internal")}
          </motion.h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {internalLinks.map((item, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                key={item.key}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <Link className="block h-full" href={item.href}>
                  <Card className="group h-full cursor-pointer border border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg">
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${item.gradient} shadow-md transition-transform duration-300 group-hover:scale-110`}
                      >
                        <item.icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
                          {t(`links.${item.key}.title`)}
                        </h3>
                        <p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                          {t(`links.${item.key}.description`)}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* External links */}
      <section className="bg-section/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="mb-8 font-bold text-2xl text-foreground md:text-3xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            {t("sections.external")}
          </motion.h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {externalLinks.map((item, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                key={item.key}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <a
                  className="block h-full"
                  href={item.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Card className="group h-full cursor-pointer border border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md transition-transform duration-300 group-hover:scale-110">
                        <Globe className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
                          {t(`external.${item.key}.title`)}
                        </h3>
                        <p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                          {t(`external.${item.key}.description`)}
                        </p>
                      </div>
                      <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground transition-colors duration-300 group-hover:text-primary" />
                    </div>
                  </Card>
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
