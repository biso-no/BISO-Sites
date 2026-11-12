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
import { SERIF_STACK, STUDIO, studioSurface } from "./studio";

/* -------------------------------------------------------------------------- */
/*  The studio's area chart card: a serif title, a period line, a colour      */
/*  legend and one gradient-filled area per series over a shared date axis.   */
/*  The dashboard's activity chart and the analytics traffic chart use it.    */
/*  Recharts stays out of `studio.tsx` so it only loads with a chart.         */
/* -------------------------------------------------------------------------- */

export interface StudioAreaSeries {
  color: string;
  /** Opacity at the top of the area's gradient fill. */
  fillOpacity: number;
  /** The data key; also names the gradient (`color` + Key). */
  key: string;
  label: string;
}

export interface StudioAreaChartProps {
  data: Array<{ date: string }>;
  /** Tailwind height class for the empty state, e.g. `h-40`. */
  emptyHeightClass: string;
  emptyLabel: string;
  hasData: boolean;
  /** Plot height in pixels. */
  height: number;
  series: StudioAreaSeries[];
  subtitle: string;
  title: string;
}

interface TooltipPayloadEntry {
  color?: string;
  dataKey?: string;
  name?: string;
  value?: number;
}

const ChartTooltip = ({
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

function gradientId(key: string): string {
  return `color${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

export function StudioAreaChart({
  data,
  emptyHeightClass,
  emptyLabel,
  hasData,
  height,
  series,
  subtitle,
  title,
}: StudioAreaChartProps) {
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
          {series.map(({ label, color }) => (
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
        <ResponsiveContainer height={height} width="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <defs>
              {series.map(({ color, fillOpacity, key }) => (
                <linearGradient
                  id={gradientId(key)}
                  key={key}
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={color}
                    stopOpacity={fillOpacity}
                  />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
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
              content={<ChartTooltip />}
              cursor={{ stroke: "rgba(26,24,20,0.12)" }}
            />
            {series.map(({ color, key, label }) => (
              <Area
                dataKey={key}
                dot={false}
                fill={`url(#${gradientId(key)})`}
                key={key}
                name={label}
                stroke={color}
                strokeWidth={1.5}
                type="monotone"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className={`flex ${emptyHeightClass} items-center justify-center`}>
          <p className="text-sm" style={{ color: STUDIO.ink4 }}>
            {emptyLabel}
          </p>
        </div>
      )}
    </div>
  );
}
