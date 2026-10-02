"use client";

import { Card } from "@repo/ui/components/ui/card";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Gavel,
  GraduationCap,
  HeartHandshake,
  History,
  Landmark,
  ShieldAlert,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const topics = [
  {
    key: "whatIsBiso",
    href: "/about/what-is-biso",
    icon: BookOpen,
  },
  {
    key: "politics",
    href: "/about/politics",
    icon: Landmark,
  },
  {
    key: "bylaws",
    href: "/about/bylaws",
    icon: Gavel,
  },
  {
    key: "history",
    href: "/about/history",
    icon: History,
  },
  {
    key: "studyQuality",
    href: "/about/study-quality",
    icon: GraduationCap,
  },
  {
    key: "operations",
    href: "/about/operations",
    icon: Building2,
  },
  {
    key: "alumni",
    href: "/about/alumni",
    icon: Users,
  },
  {
    key: "saih",
    href: "/about/saih",
    icon: HeartHandshake,
  },
  {
    key: "varsling",
    href: "/safety",
    icon: ShieldAlert,
  },
] as const;

export function TopicGrid() {
  const t = useTranslations("about");

  return (
    <section className="bg-linear-to-b from-transparent to-section/50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className="font-bold text-2xl text-foreground md:text-3xl">
            {t("hub.browse")}
          </h2>
        </motion.div>

        {/* Topic grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              key={topic.key}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <Link className="block h-full" href={topic.href}>
                <Card className="group h-full cursor-pointer border border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg">
                  <div className="flex items-start gap-4">
                    <div
                      className={
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md transition-transform duration-300 group-hover:scale-110"
                      }
                    >
                      <topic.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
                        {t(`links.${topic.key}.title`)}
                      </h3>
                      <p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                        {t(`links.${topic.key}.description`)}
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
  );
}
