"use client";

import {
  UNIT_CATEGORY_MESSAGE_KEYS,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowUpRight, MapPin } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { UnitCrest } from "@/components/units/unit-crest";
import type { PublicUnit } from "@/lib/data/units";

interface UnitCardProps {
  index: number;
  unit: PublicUnit;
}

/** Stagger only the first screenful; beyond that the delay reads as lag. */
const MAX_STAGGERED = 12;
const STAGGER_STEP = 0.04;

export function UnitCard({ unit, index }: UnitCardProps) {
  const t = useTranslations("units");
  // Category labels live in the shared `jobs.filters` bundle so units and jobs
  // name the same categories identically.
  const tCategory = useTranslations("jobs");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      transition={{
        delay: Math.min(index, MAX_STAGGERED) * STAGGER_STEP,
        duration: 0.35,
      }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <Card className="group h-full overflow-hidden border-border/50 bg-card/80 p-0 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
        <Link className="flex h-full flex-col p-5" href={unit.href}>
          <div className="flex items-start gap-4">
            <UnitCrest className="h-14 w-14 text-lg" unit={unit} />

            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-base text-foreground transition-colors group-hover:text-brand">
                {unit.name}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-muted-foreground text-xs">
                <MapPin className="h-3.5 w-3.5 text-brand" />
                {unit.campusLabel}
              </p>
            </div>

            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
          </div>

          <p className="mt-4 line-clamp-3 text-muted-foreground text-sm leading-relaxed">
            {unit.summary ?? t("card.noSummary")}
          </p>

          {unit.category && (
            <div className="mt-4 pt-1">
              <Badge
                className="text-[0.65rem] uppercase tracking-wide"
                variant="secondary"
              >
                {tCategory(
                  `filters.${UNIT_CATEGORY_MESSAGE_KEYS[unit.category as UnitCategory]}`
                )}
              </Badge>
            </div>
          )}
        </Link>
      </Card>
    </motion.div>
  );
}
