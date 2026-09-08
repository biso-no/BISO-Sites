import {
  UNIT_CATEGORY_MESSAGE_KEYS,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { Card } from "@repo/ui/components/ui/card";
import { Building2, MapPin, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ComponentType } from "react";
import { toPlainText } from "@/lib/content-text";
import type { UnitDetail } from "@/lib/data/units";

interface UnitStoryProps {
  boardCount: number;
  campusUnitCount: number;
  unit: UnitDetail;
}

/**
 * "About" plus the three facts that are actually known about every unit.
 *
 * No unit has written a description yet, so the fallback copy is not filler —
 * it is the copy this section ships with for all 125 of them. It says only
 * true, sourced things (campus, how many units share it, that the board below
 * runs this one) and points at the next action, rather than inventing the
 * "1000+ students reached" the previous version rendered for every unit.
 */
export async function UnitStory({
  unit,
  boardCount,
  campusUnitCount,
}: UnitStoryProps) {
  const t = await getTranslations("units");
  const tCategory = await getTranslations("jobs");

  const body = toPlainText(unit.description);
  const hasOwnCopy = body.length > 0;

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card className="border-border/50 bg-card/80 p-6 backdrop-blur-sm sm:p-8">
        <h2 className="font-bold text-2xl text-foreground">
          {hasOwnCopy
            ? t("detail.about", { name: unit.name })
            : t("detail.aboutFallbackTitle")}
        </h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          {hasOwnCopy
            ? body
            : t("detail.aboutFallback", {
                campus: unit.campusLabel ?? "",
                count: campusUnitCount,
                name: unit.name,
              })}
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
        <Fact
          icon={MapPin}
          label={t("detail.facts.campus")}
          value={unit.campusLabel ?? "—"}
        />
        <Fact
          icon={Building2}
          label={t("detail.facts.category")}
          value={
            unit.category
              ? tCategory(
                  `filters.${UNIT_CATEGORY_MESSAGE_KEYS[unit.category as UnitCategory]}`
                )
              : t("detail.facts.uncategorised")
          }
        />
        <Fact
          icon={Users}
          label={t("detail.facts.board")}
          value={String(boardCount)}
        />
      </div>
    </section>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center gap-3 border-border/50 bg-card/80 p-4 backdrop-blur-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted">
        <Icon className="h-5 w-5 text-brand" />
      </span>
      <span className="min-w-0">
        <span className="block text-muted-foreground text-xs uppercase tracking-wide">
          {label}
        </span>
        <span className="block truncate font-semibold text-foreground">
          {value}
        </span>
      </span>
    </Card>
  );
}
