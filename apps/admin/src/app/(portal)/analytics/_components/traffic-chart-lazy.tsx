"use client";

import dynamic from "next/dynamic";
import { STUDIO } from "../../_components/studio";

/**
 * Lazy boundary for the analytics traffic chart. recharts (~300 KB) is heavy and
 * the chart is below the KPI strip, so it is split into its own chunk loaded
 * after hydration. As a client module, `ssr: false` is permitted here (it cannot
 * be set directly from the Server Component analytics page) and avoids the
 * zero-width hydration flash of ResponsiveContainer.
 */
export const TrafficChart = dynamic(
  () => import("./traffic-chart").then((m) => m.TrafficChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-80 w-full animate-pulse rounded-3xl border"
        style={{
          background: "rgba(255,255,255,0.46)",
          borderColor: STUDIO.rule,
        }}
      />
    ),
  }
);
