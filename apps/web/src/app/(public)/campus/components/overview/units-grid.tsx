"use client";

import type { Locale } from "@repo/i18n/config";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { UnitCrest } from "@/components/units/unit-crest";
import type { PublicUnit } from "@/lib/data/units";

interface UnitsGridProps {
  activeCampusId?: string | null;
  locale: Locale;
  units: PublicUnit[];
}

const PREVIEW_COUNT = 8;

export function UnitsGrid({ units, locale, activeCampusId }: UnitsGridProps) {
  if (units.length === 0) {
    return null;
  }

  const seeAllHref = activeCampusId
    ? `/units?campus_id=${activeCampusId}`
    : "/units";

  return (
    <section>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="mb-2 font-bold text-2xl text-foreground">
            {locale === "en" ? "Our units" : "Våre enheter"}
          </h2>
          <p className="text-muted-foreground">
            {locale === "en"
              ? `${units.length} student-run units, societies and committees`
              : `${units.length} studentdrevne enheter, foreninger og komiteer`}
          </p>
        </div>
        <Button
          asChild
          className="shrink-0 text-brand"
          size="sm"
          variant="ghost"
        >
          <Link href={seeAllHref}>
            {locale === "en" ? "See all units" : "Se alle enheter"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {units.slice(0, PREVIEW_COUNT).map((unit, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 16 }}
            key={unit.id}
            transition={{ delay: index * 0.05 }}
          >
            <Link className="block h-full" href={unit.href}>
              <Card className="group h-full border-border/50 bg-card/80 p-5 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
                <UnitCrest className="mx-auto mb-4 h-14 w-14" unit={unit} />
                <h3 className="font-semibold text-foreground text-sm transition-colors group-hover:text-brand">
                  {unit.name}
                </h3>
                {unit.summary && (
                  <p className="mt-2 line-clamp-2 text-muted-foreground text-xs">
                    {unit.summary}
                  </p>
                )}
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
