"use client";

import { useMemo } from "react";
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

interface ActivityEntry {
  $createdAt: string;
  action?: string | null;
  resource_type?: string | null;
}

interface ContentActivityChartProps {
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
      style={{
        background: STUDIO.ink,
        border: `0.5px solid ${STUDIO.rule2}`,
      }}
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

export function ContentActivityChart({
  activity,
  days = 14,
}: ContentActivityChartProps) {
  const data = useMemo(() => buildChartData(activity, days), [activity, days]);
  const hasActivity = activity.length > 0;

  return (
    <div className="rounded-3xl p-6 md:p-8" style={studioSurface}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2
            className="text-2xl"
            style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
          >
            Activity
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
            Last {days} days
          </p>
        </div>
        <div
          className="flex items-center gap-4 text-xs"
          style={{ color: STUDIO.ink3 }}
        >
          {[
            { label: "Events", color: STUDIO.claret },
            { label: "News", color: STUDIO.sky },
            { label: "Jobs", color: STUDIO.leaf },
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

      {hasActivity ? (
        <ResponsiveContainer height={180} width="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorEvents" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={STUDIO.claret}
                  stopOpacity={0.22}
                />
                <stop offset="95%" stopColor={STUDIO.claret} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorNews" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={STUDIO.sky} stopOpacity={0.18} />
                <stop offset="95%" stopColor={STUDIO.sky} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorJobs" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={STUDIO.leaf} stopOpacity={0.18} />
                <stop offset="95%" stopColor={STUDIO.leaf} stopOpacity={0} />
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
              dataKey="events"
              dot={false}
              fill="url(#colorEvents)"
              name="Events"
              stroke={STUDIO.claret}
              strokeWidth={1.5}
              type="monotone"
            />
            <Area
              dataKey="news"
              dot={false}
              fill="url(#colorNews)"
              name="News"
              stroke={STUDIO.sky}
              strokeWidth={1.5}
              type="monotone"
            />
            <Area
              dataKey="jobs"
              dot={false}
              fill="url(#colorJobs)"
              name="Jobs"
              stroke={STUDIO.leaf}
              strokeWidth={1.5}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm" style={{ color: STUDIO.ink4 }}>
            No activity recorded yet
          </p>
        </div>
      )}
    </div>
  );
}
