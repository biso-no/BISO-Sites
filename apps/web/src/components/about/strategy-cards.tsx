"use client";

import { Card } from "@repo/ui/components/ui/card";
import { Link, Megaphone, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

const strategyItems = [
  {
    key: "impact" as const,
    icon: Megaphone,
    gradient: "from-brand-gradient-from to-brand-gradient-to",
  },
  {
    key: "connected" as const,
    icon: Link,
    gradient: "from-brand-gradient-from to-cyan-600",
  },
  {
    key: "engaged" as const,
    icon: Sparkles,
    gradient: "from-brand-gradient-to to-brand-gradient-from",
  },
];

export function StrategyCards() {
  const t = useTranslations("about.general.strategy");

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="mb-4 inline-block rounded-full bg-brand-muted px-4 py-2 text-brand-dark">
            {t("title")}
          </div>
          <h2 className="mb-4 font-bold text-3xl text-foreground md:text-4xl">
            <span className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to bg-clip-text text-transparent">
              {t("subtitle")}
            </span>
          </h2>
        </motion.div>

        {/* Cards grid */}
        <div className="grid gap-8 md:grid-cols-3">
          {strategyItems.map((item, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              key={item.key}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <Card className="group h-full border-0 p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
                <div
                  className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br ${item.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110`}
                >
                  <item.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-3 font-semibold text-foreground text-xl">
                  {t(`items.${item.key}.title`)}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t(`items.${item.key}.desc`)}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
