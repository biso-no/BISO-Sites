"use client";

import { Card } from "@repo/ui/components/ui/card";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Rocket,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

/** What BISO does on each campus, with the four quick-link tiles. */
export function WhatWeDoSection() {
  const t = useTranslations("about");
  const tHome = useTranslations("home");
  const items = [0, 1, 2, 3, 4].map((i) => t(`general.whatWeDo.items.${i}`));
  const tiles = [
    { icon: Calendar, label: tHome("about.upcomingEvents") },
    { icon: Briefcase, label: tHome("about.jobOpportunities") },
    { icon: Rocket, label: tHome("about.studentGroups") },
    { icon: GraduationCap, label: t("general.academics.title") },
  ];

  return (
    <section className="scroll-mt-28 bg-section/50 py-16" id="hva-vi-gjor">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
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
              {items.map((item) => (
                <li className="flex items-start gap-3" key={item}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="grid gap-4 sm:grid-cols-2"
            initial={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            {tiles.map((tile) => (
              <Card
                className="group p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                key={tile.label}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md">
                  <tile.icon className="h-6 w-6 text-white" />
                </div>
                <p className="font-medium text-muted-foreground text-sm">
                  {tile.label}
                </p>
              </Card>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
