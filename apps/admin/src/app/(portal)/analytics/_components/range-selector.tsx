"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { STUDIO } from "../../_components/studio";

export type AnalyticsRange = "7d" | "30d" | "90d";

const RANGES: AnalyticsRange[] = ["7d", "30d", "90d"];

export function RangeSelector({
  current,
  labels,
}: {
  current: AnalyticsRange;
  labels: Record<AnalyticsRange, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function selectRange(range: AnalyticsRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <fieldset
      aria-label="Date range"
      className="inline-flex items-center gap-1 rounded-lg p-1"
      style={{
        background: "rgba(255,255,255,0.55)",
        border: `0.5px solid ${STUDIO.rule2}`,
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {RANGES.map((range) => {
        const active = range === current;
        return (
          <button
            aria-pressed={active}
            className="rounded-md px-3 py-1.5 font-medium text-xs transition"
            key={range}
            onClick={() => selectRange(range)}
            style={
              active
                ? { background: STUDIO.ink, color: STUDIO.paper }
                : { background: "transparent", color: STUDIO.ink2 }
            }
            type="button"
          >
            {labels[range]}
          </button>
        );
      })}
    </fieldset>
  );
}
