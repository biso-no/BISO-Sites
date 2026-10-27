import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * The counter row from the reference's footer and campus band.
 *
 * Figures use the tabular `data` role so a row of numbers reads as a set rather
 * than as drifting glyphs. Collapses to 2x2 below 640px.
 *
 * **Only render figures that come from real data.** The reference shows
 * "1000+ Active Members" and "25+ Societies"; `cachedHomeCounts` supplies only
 * event and job counts, and member numbers are not public. Omit a tile rather
 * than invent one — see PLACEHOLDER-004 in 01-design-spec.md §6.
 */
export interface Stat {
  icon?: ReactNode;
  label: string;
  /** Pre-formatted, e.g. "50+". Formatting belongs to the caller's locale. */
  value: string;
}

export function StatRow({
  stats,
  className,
}: {
  stats: Stat[];
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-6 sm:grid-cols-4", className)}>
      {stats.map((s) => (
        <div className="flex flex-col gap-1" key={s.label}>
          {s.icon ? (
            <span aria-hidden="true" className="text-ink-accent">
              {s.icon}
            </span>
          ) : null}
          <dt className="type-body-sm order-2 text-ink-muted">{s.label}</dt>
          <dd className="type-data order-1 text-3xl leading-none">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
