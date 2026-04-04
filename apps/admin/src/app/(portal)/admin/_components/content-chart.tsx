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

type ActivityEntry = {
  $createdAt: string;
  action?: string | null;
  resource_type?: string | null;
};

type ContentActivityChartProps = {
  activity: ActivityEntry[];
  days?: number;
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildChartData(activity: ActivityEntry[], days: number) {
  const now = new Date();
  const buckets: Record<string, { events: number; news: number; jobs: number; other: number }> = {};

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
    if (!(label in buckets)) continue;

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs space-y-1.5"
      style={{ background: "rgba(0,10,22,0.95)", border: "1px solid rgba(255,255,255,0.10)" }}
    >
      <p className="font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.50)" }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: "rgba(255,255,255,0.70)" }}>{p.name}:</span>
          <span className="font-mono font-medium" style={{ color: "#fff" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function ContentActivityChart({ activity, days = 14 }: ContentActivityChartProps) {
  const data = useMemo(() => buildChartData(activity, days), [activity, days]);
  const hasActivity = activity.length > 0;

  return (
    <div
      className="rounded-3xl p-6 md:p-8"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-medium" style={{ color: "#fff" }}>Activity</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.30)" }}>
            Last {days} days
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
          {[
            { label: "Events", color: "#3DA9E0" },
            { label: "News", color: "#a78bfa" },
            { label: "Jobs", color: "#4ade80" },
          ].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {!hasActivity ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
            No activity recorded yet
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3DA9E0" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3DA9E0" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorNews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={28}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)" }} />
            <Area
              type="monotone"
              dataKey="events"
              name="Events"
              stroke="#3DA9E0"
              strokeWidth={1.5}
              fill="url(#colorEvents)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="news"
              name="News"
              stroke="#a78bfa"
              strokeWidth={1.5}
              fill="url(#colorNews)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="jobs"
              name="Jobs"
              stroke="#4ade80"
              strokeWidth={1.5}
              fill="url(#colorJobs)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
