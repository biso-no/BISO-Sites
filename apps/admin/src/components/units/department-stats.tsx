"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronsUpDown,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { MetricCard } from "@/components/shared/metric-card";
import type { Department } from "@/lib/admin/departments";

type DepartmentStatsProps = {
  departments: Department[];
  loading?: boolean;
};

export function DepartmentStats({
  departments,
  loading = false,
}: DepartmentStatsProps) {
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [campusCounts, setCampusCounts] = useState<Record<string, number>>({});
  const [showMoreCampuses, setShowMoreCampuses] = useState(false);

  useEffect(() => {
    if (!departments.length) {
      return;
    }

    // Calculate stats
    const active = departments.filter((d) => d.active).length;
    setActiveCount(active);
    setInactiveCount(departments.length - active);

    const users = departments.reduce(
      (sum, dept) => sum + (dept.userCount || 0),
      0
    );
    setTotalUsers(users);

    // Count departments per campus
    const campusStats: Record<string, number> = {};
    departments.forEach((dept) => {
      const campusName = dept.campusName || "Unassigned";
      campusStats[campusName] = (campusStats[campusName] || 0) + 1;
    });
    setCampusCounts(campusStats);
  }, [departments]);

  // Sort campuses by count (descending)
  const sortedCampuses = Object.entries(campusCounts).sort(
    ([, countA], [, countB]) => countB - countA
  );

  // Limit to top 3 by default
  const displayCampuses = showMoreCampuses
    ? sortedCampuses
    : sortedCampuses.slice(0, 3);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div className="h-32 animate-pulse rounded-xl bg-muted" key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Building2}
          iconBgColor="bg-primary/10"
          iconColor="text-primary"
          title="Total Units"
          value={departments.length}
        />

        <MetricCard
          icon={Users}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-600"
          title="Total Members"
          value={totalUsers}
        />

        <MetricCard
          icon={Check}
          iconBgColor="bg-green-500/10"
          iconColor="text-green-600"
          title="Active Units"
          value={activeCount}
        />

        <MetricCard
          icon={AlertTriangle}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-600"
          title="Inactive Units"
          value={inactiveCount}
        />
      </div>

      {/* Campus Distribution */}
      {departments.length > 0 && sortedCampuses.length > 0 && (
        <GlassCard
          className="fade-in-50 slide-in-from-bottom-4 animate-in duration-500"
          description="Department distribution across all campuses"
          title="Campus Distribution"
          variant="premium"
        >
          <div className="space-y-4">
            {displayCampuses.map(([campusName, count], index) => {
              const percentage = Math.round((count / departments.length) * 100);
              return (
                <div
                  className="fade-in-50 slide-in-from-left-4 animate-in space-y-2"
                  key={campusName}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {campusName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {count} units
                      </span>
                      <span className="font-semibold text-primary">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/50">
                    {/* Animated gradient bar */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-primary to-accent shadow-sm transition-all duration-1000 ease-out"
                      style={{
                        width: `${percentage}%`,
                        transitionDelay: `${index * 100}ms`,
                      }}
                    >
                      <div className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/20 to-transparent" />
                    </div>
                  </div>
                </div>
              );
            })}

            {sortedCampuses.length > 3 && (
              <div className="flex justify-center pt-2">
                <Button
                  className="gap-2 text-primary hover:text-primary/80"
                  onClick={() => setShowMoreCampuses(!showMoreCampuses)}
                  size="sm"
                  variant="ghost"
                >
                  {showMoreCampuses
                    ? "Show Less"
                    : `Show All ${sortedCampuses.length} Campuses`}
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
