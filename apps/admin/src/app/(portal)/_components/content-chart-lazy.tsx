"use client";

import dynamic from "next/dynamic";
import { STUDIO } from "./studio";

/**
 * Lazy boundary for the dashboard activity chart. recharts (~300 KB) is heavy
 * and the chart sits below the fold, so it is split into its own chunk loaded
 * after hydration instead of shipping in the initial dashboard bundle. This
 * wrapper is a client module so `ssr: false` is permitted (it cannot be used
 * directly from the Server Component dashboard page).
 */
export const ContentActivityChart = dynamic(
  () => import("./content-chart").then((m) => m.ContentActivityChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-72 w-full animate-pulse rounded-2xl border"
        style={{
          background: "rgba(255,255,255,0.46)",
          borderColor: STUDIO.rule,
        }}
      />
    ),
  }
);
