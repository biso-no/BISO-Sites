"use client";

import { STUDIO } from "../../_components/studio";
import { StudioAreaChart } from "../../_components/studio-area-chart";

export interface TrafficPoint {
  date: string;
  pageviews: number;
  sessions: number;
}

export interface TrafficChartProps {
  data: TrafficPoint[];
  emptyLabel: string;
  legend: { pageviews: string; sessions: string };
  subtitle: string;
  title: string;
}

export function TrafficChart({
  data,
  emptyLabel,
  legend,
  subtitle,
  title,
}: TrafficChartProps) {
  return (
    <StudioAreaChart
      data={data}
      emptyHeightClass="h-48"
      emptyLabel={emptyLabel}
      hasData={data.some((d) => d.pageviews > 0 || d.sessions > 0)}
      height={220}
      series={[
        {
          color: STUDIO.claret,
          fillOpacity: 0.22,
          key: "pageviews",
          label: legend.pageviews,
        },
        {
          color: STUDIO.sky,
          fillOpacity: 0.18,
          key: "sessions",
          label: legend.sessions,
        },
      ]}
      subtitle={subtitle}
      title={title}
    />
  );
}
