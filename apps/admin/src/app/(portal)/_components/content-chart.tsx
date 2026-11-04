"use client";

import { useMemo } from "react";
import { STUDIO } from "./studio";
import { StudioAreaChart, type StudioAreaSeries } from "./studio-area-chart";

interface ActivityEntry {
  $createdAt: string;
  action?: string | null;
  resource_type?: string | null;
}

export interface ContentActivityChartProps {
  activity: ActivityEntry[];
  days?: number;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildChartData(activity: ActivityEntry[], days: number) {
  const now = new Date();
  const buckets: Record<
    string,
    { events: number; news: number; jobs: number; other: number }
  > = {};

  // Create empty buckets for each day
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    buckets[formatDate(d)] = { events: 0, news: 0, jobs: 0, other: 0 };
  }

  // Fill buckets from activity
  for (const entry of activity) {
    const d = new Date(entry.$createdAt);
    d.setHours(0, 0, 0, 0);
    const label = formatDate(d);
    if (!(label in buckets)) {
      continue;
    }

    const rt = (entry.resource_type ?? "").toLowerCase();
    const bucket = buckets[label];
    if (rt.includes("event")) {
      bucket.events++;
    } else if (rt.includes("news")) {
      bucket.news++;
    } else if (rt.includes("job")) {
      bucket.jobs++;
    } else {
      bucket.other++;
    }
  }

  return Object.entries(buckets).map(([date, counts]) => ({ date, ...counts }));
}

const SERIES: StudioAreaSeries[] = [
  { color: STUDIO.claret, fillOpacity: 0.22, key: "events", label: "Events" },
  { color: STUDIO.sky, fillOpacity: 0.18, key: "news", label: "News" },
  { color: STUDIO.leaf, fillOpacity: 0.18, key: "jobs", label: "Jobs" },
];

export function ContentActivityChart({
  activity,
  days = 14,
}: ContentActivityChartProps) {
  const data = useMemo(() => buildChartData(activity, days), [activity, days]);

  return (
    <StudioAreaChart
      data={data}
      emptyHeightClass="h-40"
      emptyLabel="No activity recorded yet"
      hasData={activity.length > 0}
      height={180}
      series={SERIES}
      subtitle={`Last ${days} days`}
      title="Activity"
    />
  );
}
