"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  BarChart3,
  Eye,
  MousePointerClick,
  ShoppingBag,
  Unlock,
} from "lucide-react";
import type { BenefitAnalyticsSummary } from "@/app/actions/benefit-analytics";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";

type Props = { summary: BenefitAnalyticsSummary };

const STAT_CARDS = [
  {
    key: "totalViews" as const,
    label: "Total Views",
    icon: Eye,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    key: "totalReveals" as const,
    label: "Code Reveals",
    icon: Unlock,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    key: "totalClicks" as const,
    label: "Link Clicks",
    icon: MousePointerClick,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    key: "totalRedeems" as const,
    label: "Redeemed",
    icon: ShoppingBag,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
];

export function AnalyticsDashboardClient({ summary }: Props) {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, bg }) => (
          <Card className="glass-panel" key={key}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <span className={`rounded-xl p-2 ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </span>
                {summary[key].toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Benefits */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Top Benefits by Engagement
            </CardTitle>
            <CardDescription>
              Most interacted benefits across all actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.topBenefits.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground text-sm">
                No interaction data yet. Publish some benefits to start tracking
                engagement.
              </p>
            ) : (
              <div className="space-y-3">
                {summary.topBenefits.map((item, i) => {
                  const maxCount = summary.topBenefits[0]?.count ?? 1;
                  const pct = Math.round((item.count / maxCount) * 100);
                  return (
                    <div className="space-y-1" key={item.benefit_id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="font-bold text-muted-foreground text-xs">
                            #{i + 1}
                          </span>
                          <span className="font-medium font-mono text-xs">
                            {item.benefit_id.slice(0, 8)}…
                          </span>
                        </span>
                        <span className="font-bold">{item.count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Campus */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Engagement by Campus
            </CardTitle>
            <CardDescription>Total interactions per campus</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.byCampus.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground text-sm">
                No campus data yet.
              </p>
            ) : (
              <div className="space-y-3">
                {summary.byCampus
                  .sort((a, b) => b.count - a.count)
                  .map((item) => {
                    const maxCount = Math.max(
                      ...summary.byCampus.map((c) => c.count)
                    );
                    const pct = Math.round((item.count / maxCount) * 100);
                    return (
                      <div className="space-y-1" key={item.campus_id}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {CAMPUS_ID_TO_NAME[item.campus_id] ??
                              item.campus_id}
                          </span>
                          <span className="font-bold">{item.count}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-muted-foreground text-xs">
        Data reflects interactions recorded in the benefit_interactions table.
        Refresh the page for latest data.
      </p>
    </div>
  );
}
