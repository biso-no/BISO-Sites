"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SERIF_STACK, STUDIO, studioSurface } from "../../_components/studio";

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

interface TooltipPayloadEntry {
  color?: string;
  dataKey?: string;
  name?: string;
  value?: number;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadEntry[];
}) => {
  if (!(active && payload?.length)) {
    return null;
  }
  return (
    <div
      className="space-y-1.5 rounded-xl px-3 py-2.5 text-xs"
      style={{ background: STUDIO.ink, border: `0.5px solid ${STUDIO.rule2}` }}
    >
      <p
        className="mb-1.5 font-medium"
        style={{ color: "rgba(250,247,242,0.62)" }}
      >
        {label}
      </p>
      {payload.map((p) => (
        <div className="flex items-center gap-2" key={p.dataKey}>
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          <span style={{ color: "rgba(250,247,242,0.72)" }}>{p.name}:</span>
          <span
            className="font-medium font-mono"
            style={{ color: STUDIO.paper }}
          >
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function TrafficChart({
  data,
  emptyLabel,
  legend,
  subtitle,
  title,
}: TrafficChartProps) {
  const hasData = data.some((d) => d.pageviews > 0 || d.sessions > 0);

  return (
    <div className="rounded-3xl p-6 md:p-8" style={studioSurface}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2
            className="text-2xl"
            style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
          >
            {title}
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
            {subtitle}
          </p>
        </div>
        <div
          className="flex items-center gap-4 text-xs"
          style={{ color: STUDIO.ink3 }}
        >
          {[
            { label: legend.pageviews, color: STUDIO.claret },
            { label: legend.sessions, color: STUDIO.sky },
          ].map(({ label, color }) => (
            <span className="flex items-center gap-1.5" key={label}>
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: color }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {hasData ? (
        <ResponsiveContainer height={220} width="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorPageviews" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={STUDIO.claret}
                  stopOpacity={0.22}
                />
                <stop offset="95%" stopColor={STUDIO.claret} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSessions" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={STUDIO.sky} stopOpacity={0.18} />
                <stop offset="95%" stopColor={STUDIO.sky} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="rgba(26,24,20,0.08)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              axisLine={false}
              dataKey="date"
              interval="preserveStartEnd"
              tick={{ fontSize: 10, fill: STUDIO.ink4 }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: STUDIO.ink4 }}
              tickLine={false}
              width={28}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "rgba(26,24,20,0.12)" }}
            />
            <Area
              dataKey="pageviews"
              dot={false}
              fill="url(#colorPageviews)"
              name={legend.pageviews}
              stroke={STUDIO.claret}
              strokeWidth={1.5}
              type="monotone"
            />
            <Area
              dataKey="sessions"
              dot={false}
              fill="url(#colorSessions)"
              name={legend.sessions}
              stroke={STUDIO.sky}
              strokeWidth={1.5}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm" style={{ color: STUDIO.ink4 }}>
            {emptyLabel}
          </p>
        </div>
      )}
    </div>
  );
}
