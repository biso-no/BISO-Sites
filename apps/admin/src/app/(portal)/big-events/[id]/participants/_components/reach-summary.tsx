"use client";

import { Bell, BellOff, type LucideIcon, Mail, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PileFilter } from "@/lib/big-events/participant-list";
import { REACH_PILES, type ReachPile } from "@/lib/big-events/reach";
import { MONO_STACK, STUDIO } from "../../../../_components/studio";

export const PILE_ICONS: Record<ReachPile, LucideIcon> = {
  app_no_push: BellOff,
  email: Mail,
  push: Bell,
};

const CHIPS: PileFilter[] = ["all", ...REACH_PILES];

interface ReachSummaryProps {
  active: PileFilter;
  counts: Record<ReachPile, number>;
  onSelect: (pile: PileFilter) => void;
  total: number;
}

/** "In the app with notifications: 81 · …": each count is a filter chip. */
export function ReachSummary({
  active,
  counts,
  onSelect,
  total,
}: ReachSummaryProps) {
  const t = useTranslations("adminPortal.bigEvents.participants.reach");

  return (
    <section aria-label={t("label")} className="mb-5">
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((pile) => {
          const isActive = active === pile;
          const Icon = pile === "all" ? Users : PILE_ICONS[pile];
          return (
            <button
              aria-pressed={isActive}
              className="inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors"
              key={pile}
              onClick={() => onSelect(pile)}
              style={{
                background: isActive ? STUDIO.ink : "rgba(255,255,255,0.55)",
                borderColor: isActive ? STUDIO.ink : STUDIO.rule2,
                color: isActive ? STUDIO.paper : STUDIO.ink2,
              }}
              type="button"
            >
              <Icon aria-hidden size={14} />
              <span>{t(pile)}</span>
              <span className="tabular-nums" style={{ fontFamily: MONO_STACK }}>
                {pile === "all" ? total : counts[pile]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs" style={{ color: STUDIO.ink4 }}>
        {t("help")}
      </p>
    </section>
  );
}
