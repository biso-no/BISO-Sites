"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import type { ChartConfig } from "@repo/ui/components/ui/charts";
import {
  BarChartCard,
  LineChartCard,
  PieChartCard,
} from "@repo/ui/components/ui/charts";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { cn } from "@repo/ui/lib/utils";
import { AlertCircleIcon, BellIcon, CheckCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import type { DashboardMetrics } from "@/lib/actions/admin-dashboard";
import { DEPARTMENT_ROLE, ROLES } from "@/lib/roles";

const formatNumber = (value: number) => {
  if (value === undefined || value === null) {
    return "0";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toLocaleString();
};

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0%";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
};

// Chart configurations
const pageViewsConfig: ChartConfig = {
  views: { label: "Views", color: "var(--chart-1)" },
};

const userGrowthConfig: ChartConfig = {
  users: { label: "Users", color: "var(--chart-1)" },
};

const userDistributionConfig: ChartConfig = {
  admin: { label: "Admin", color: "var(--chart-1)" },
  member: { label: "Member", color: "var(--chart-2)" },
  guest: { label: "Guest", color: "var(--chart-3)" },
  premium: { label: "Premium", color: "var(--chart-4)" },
  other: { label: "Other", color: "var(--chart-5)" },
};

const trafficConfig: ChartConfig = {
  organic: { label: "Organic", color: "var(--chart-1)" },
  direct: { label: "Direct", color: "var(--chart-2)" },
  referral: { label: "Referral", color: "var(--chart-3)" },
  social: { label: "Social", color: "var(--chart-4)" },
  other: { label: "Other", color: "var(--chart-5)" },
};

const postEngagementConfig: ChartConfig = {
  likes: { label: "Likes", color: "var(--chart-1)" },
  comments: { label: "Comments", color: "var(--chart-2)" },
  shares: { label: "Shares", color: "var(--chart-3)" },
};

const audienceGrowthConfig: ChartConfig = {
  followers: { label: "Followers", color: "var(--chart-1)" },
};

const revenueConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-2)" },
};

const expenseConfig: ChartConfig = {
  marketing: { label: "Marketing", color: "var(--chart-1)" },
  operations: { label: "Operations", color: "var(--chart-2)" },
  salaries: { label: "Salaries", color: "var(--chart-3)" },
  equipment: { label: "Equipment", color: "var(--chart-4)" },
  other: { label: "Other", color: "var(--chart-5)" },
};

const jobApplicationsConfig: ChartConfig = {
  applications: { label: "Applications", color: "var(--chart-1)" },
  openPositions: { label: "Open Positions", color: "var(--chart-2)" },
};

const employeeConfig: ChartConfig = {
  engineering: { label: "Engineering", color: "var(--chart-1)" },
  design: { label: "Design", color: "var(--chart-2)" },
  marketing: { label: "Marketing", color: "var(--chart-3)" },
  sales: { label: "Sales", color: "var(--chart-4)" },
  other: { label: "Other", color: "var(--chart-5)" },
};

export type DateRange = "7d" | "30d" | "90d" | "all";

export default function AdminDashboard({
  totalUsers,
  totalPageViews,
  totalOrders: _totalOrders,
  totalJobApplications,
  pageViews,
  userDistribution,
  userGrowth,
  trafficSources,
  recentActivities,
  systemAlerts,
  postEngagement,
  audienceGrowth,
  revenueByProduct,
  expenseCategories,
  jobApplications,
  employeeDistribution,
}: DashboardMetrics) {
  const t = useTranslations("admin");
  const [role, setRole] = useState<string>(ROLES.GLOBAL_ADMIN);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const ROLE_OPTIONS = [
    {
      value: ROLES.GLOBAL_ADMIN,
      label: t("dashboard.roleOptions.admin"),
      accent: "bg-primary-40 text-white",
    },
    {
      value: ROLES.CAMPUS_ADMIN,
      label: t("dashboard.roleOptions.campusAdmin"),
      accent: "bg-secondary-100/80 text-primary-100",
    },
    {
      value: DEPARTMENT_ROLE,
      label: t("dashboard.roleOptions.department"),
      accent: "bg-primary-10/70 text-primary-100",
    },
  ];

  const SECTION_TABS = [
    { value: "overview", label: t("dashboard.tabs.overview") },
    { value: "analytics", label: t("dashboard.tabs.analytics") },
    { value: "reports", label: t("dashboard.tabs.reports") },
    { value: "notifications", label: t("dashboard.tabs.notifications") },
  ];

  const DATE_RANGE_OPTIONS = [
    { value: "7d" as const, label: t("dashboard.dateRange.last7Days") },
    { value: "30d" as const, label: t("dashboard.dateRange.last30Days") },
    { value: "90d" as const, label: t("dashboard.dateRange.last90Days") },
    { value: "all" as const, label: t("dashboard.dateRange.allTime") },
  ];

  // Filter data based on selected date range
  const getDateCutoff = useCallback((range: DateRange): Date | null => {
    if (range === "all") {
      return null;
    }
    const days = (() => {
      if (range === "7d") {
        return 7;
      }
      if (range === "30d") {
        return 30;
      }
      return 90;
    })();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
  }, []);

  const filteredData = useMemo(() => {
    const cutoff = getDateCutoff(dateRange);
    if (!cutoff) {
      return {
        pageViews,
        revenueByProduct,
        expenseCategories,
        postEngagement,
        audienceGrowth,
        jobApplications,
      };
    }

    return {
      pageViews,
      revenueByProduct,
      expenseCategories,
      postEngagement,
      audienceGrowth,
      jobApplications,
    };
  }, [
    dateRange,
    pageViews,
    revenueByProduct,
    expenseCategories,
    postEngagement,
    audienceGrowth,
    jobApplications,
    getDateCutoff,
  ]);

  const topPage = filteredData.pageViews.reduce(
    (best, current) => (current.views > (best?.views ?? 0) ? current : best),
    filteredData.pageViews[0] ?? null
  );
  const previousUsers = userGrowth.at(-2)?.users ?? totalUsers;
  const userGrowthRate =
    previousUsers > 0
      ? ((totalUsers - previousUsers) / previousUsers) * 100
      : 0;
  const topTrafficSource = trafficSources.reduce(
    (best, current) => (current.value > (best?.value ?? 0) ? current : best),
    trafficSources[0] ?? null
  );
  const alertCounts = systemAlerts.reduce(
    (acc, alert) => {
      acc[alert.type] = (acc[alert.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalAlerts = systemAlerts.length;
  const openPositions = jobApplications.reduce(
    (sum, job) => sum + (job.openPositions ?? 0),
    0
  );

  const summaryMetrics = useMemo(() => {
    const totalPageViewsDescription = topPage
      ? t("dashboard.summary.totalPageViews.descriptionTopPage", {
          page: topPage.name,
        })
      : t("dashboard.summary.totalPageViews.descriptionNoPage");

    return [
      {
        label: t("dashboard.summary.totalPageViews.label"),
        value: formatNumber(totalPageViews),
        description: totalPageViewsDescription,
        badge: formatPercent(userGrowthRate),
        badgeTone: userGrowthRate >= 0 ? "text-emerald-500" : "text-red-500",
      },
      {
        label: t("dashboard.summary.activeMembers.label"),
        value: formatNumber(totalUsers),
        description: t("dashboard.summary.activeMembers.description"),
        badge: t("dashboard.summary.activeMembers.segments", {
          count: userDistribution.length,
        }),
        badgeTone: "text-muted-foreground",
      },
      {
        label: t("dashboard.summary.systemAlerts.label"),
        value: formatNumber(totalAlerts),
        description: t("dashboard.summary.systemAlerts.description"),
        badge: t("dashboard.summary.systemAlerts.critical", {
          count: alertCounts.error ?? 0,
        }),
        badgeTone:
          (alertCounts.error ?? 0) > 0 ? "text-red-500" : "text-secondary-100",
      },
      {
        label: t("dashboard.summary.jobPipeline.label"),
        value: formatNumber(totalJobApplications),
        description: t("dashboard.summary.jobPipeline.description", {
          count: openPositions,
        }),
        badge: topTrafficSource
          ? t("dashboard.summary.jobPipeline.traffic", {
              source: topTrafficSource.name,
            })
          : t("dashboard.summary.jobPipeline.tracking"),
        badgeTone: "text-muted-foreground",
      },
    ];
  }, [
    alertCounts.error,
    openPositions,
    topPage,
    topTrafficSource,
    totalAlerts,
    totalJobApplications,
    totalPageViews,
    totalUsers,
    userDistribution.length,
    userGrowthRate,
    t,
  ]);

  const baseCardClasses =
    "glass-panel border border-primary/10 bg-white/80 shadow-[0_25px_45px_-30px_rgba(0,23,49,0.3)]";

  const renderRoleSpecificContent = (currentRole: string, tab: string) => {
    switch (currentRole) {
      case ROLES.GLOBAL_ADMIN:
        return renderAdminContent(tab);
      case ROLES.CAMPUS_ADMIN:
        return renderFinanceContent(tab);
      case DEPARTMENT_ROLE:
        return renderPRContent(tab);
      default:
        return <div>{t("dashboard.missingRoleContent")}</div>;
    }
  };

  const renderAdminOverview = () => (
    <>
      <BarChartCard
        className={cn(baseCardClasses, "col-span-2")}
        config={pageViewsConfig}
        data={filteredData.pageViews}
        dataKeys="views"
        description={t("dashboard.cards.pageViews.description")}
        title={t("dashboard.cards.pageViews.title")}
        xAxisFormatter={(value) => value.slice(0, 10)}
        xAxisKey="name"
      />
      <PieChartCard
        className={baseCardClasses}
        config={userDistributionConfig}
        data={userDistribution}
        dataKey="value"
        description={t("dashboard.cards.userDistribution.description")}
        labelRenderer={({ name, percent }) =>
          `${name} ${(percent * 100).toFixed(0)}%`
        }
        nameKey="name"
        outerRadius={80}
        showLabels
        title={t("dashboard.cards.userDistribution.title")}
      />
      <LineChartCard
        className={cn(baseCardClasses, "col-span-3")}
        config={userGrowthConfig}
        data={userGrowth}
        dataKeys="users"
        description={t("dashboard.cards.userGrowth.overviewDescription")}
        title={t("dashboard.cards.userGrowth.title")}
        xAxisKey="date"
      />
    </>
  );

  const renderAdminAnalytics = () => (
    <>
      <Card className={baseCardClasses}>
        <CardHeader>
          <CardTitle>{t("dashboard.cards.totalPageViews.title")}</CardTitle>
          <CardDescription>
            {t("dashboard.cards.totalPageViews.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="font-bold text-3xl">
            {totalPageViews.toLocaleString()}
          </div>
          {topPage ? (
            <div className="text-muted-foreground text-sm">
              {t("dashboard.analytics.topPageLabel", {
                page: topPage.name,
              })}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              {t("dashboard.analytics.noPageData")}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className={baseCardClasses}>
        <CardHeader>
          <CardTitle>{t("dashboard.cards.userGrowth.title")}</CardTitle>
          <CardDescription>
            {t("dashboard.cards.userGrowth.analyticsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="font-bold text-3xl">
            {totalUsers.toLocaleString()}
          </div>
          <div
            className={`text-sm ${userGrowthRate >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {userGrowthRate >= 0 ? "+" : ""}
            {userGrowthRate.toFixed(1)}%
          </div>
        </CardContent>
      </Card>
      <Card className={baseCardClasses}>
        <CardHeader>
          <CardTitle>{t("dashboard.cards.topTrafficSource.title")}</CardTitle>
          <CardDescription>
            {t("dashboard.cards.topTrafficSource.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topTrafficSource ? (
            <>
              <div className="font-bold text-3xl">{topTrafficSource.name}</div>
              <div className="text-muted-foreground text-sm">
                {topTrafficSource.value.toLocaleString()} sessions
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">
              No traffic data available
            </div>
          )}
        </CardContent>
      </Card>

      <PieChartCard
        className={cn(baseCardClasses, "col-span-2")}
        config={trafficConfig}
        data={trafficSources}
        dataKey="value"
        description={t("dashboard.cards.trafficBreakdown.description")}
        labelRenderer={({ name, percent }) =>
          `${name} ${(percent * 100).toFixed(0)}%`
        }
        nameKey="name"
        outerRadius={100}
        showLabels
        title={t("dashboard.cards.trafficBreakdown.title")}
      />
    </>
  );

  const renderAdminReports = () => (
    <Card className={cn(baseCardClasses, "col-span-3")}>
      <CardHeader>
        <CardTitle>{t("dashboard.cards.recentActivities.title")}</CardTitle>
        <CardDescription>
          {t("dashboard.cards.recentActivities.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("dashboard.cards.table.user")}</TableHead>
              <TableHead>{t("dashboard.cards.table.action")}</TableHead>
              <TableHead>{t("dashboard.cards.table.timestamp")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentActivities.map((activity) => (
              <TableRow key={activity.id}>
                <TableCell>{activity.user}</TableCell>
                <TableCell>{activity.action}</TableCell>
                <TableCell>{activity.timestamp}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderAdminNotifications = () => (
    <>
      <Card className={baseCardClasses}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircleIcon className="h-5 w-5 text-red-500" />
            {t("dashboard.notifications.errors.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-bold text-3xl text-red-600">
            {alertCounts.error ?? 0}
          </div>
          <div className="text-gray-600 text-sm">
            {t("dashboard.notifications.errors.description")}
          </div>
        </CardContent>
      </Card>
      <Card className={baseCardClasses}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellIcon className="h-5 w-5 text-yellow-500" />
            {t("dashboard.notifications.warnings.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-bold text-3xl text-yellow-600">
            {alertCounts.warning ?? 0}
          </div>
          <div className="text-gray-600 text-sm">
            {t("dashboard.notifications.warnings.description")}
          </div>
        </CardContent>
      </Card>
      <Card className={baseCardClasses}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellIcon className="h-5 w-5 text-blue-500" />
            {t("dashboard.notifications.info.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-bold text-3xl text-blue-600">
            {alertCounts.info ?? 0}
          </div>
          <div className="text-gray-600 text-sm">
            {t("dashboard.notifications.info.description")}
          </div>
        </CardContent>
      </Card>
      <Card className={baseCardClasses}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            {t("dashboard.notifications.success.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-bold text-3xl text-green-600">
            {alertCounts.success ?? 0}
          </div>
          <div className="text-gray-600 text-sm">
            {t("dashboard.notifications.success.description")}
          </div>
        </CardContent>
      </Card>

      <Card className={cn(baseCardClasses, "col-span-1")}>
        <CardHeader>
          <CardTitle>
            {t("dashboard.notifications.systemAlerts.title")}
          </CardTitle>
          <CardDescription>
            {t("dashboard.notifications.systemAlerts.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {systemAlerts.map((alert) => (
              <div className="mb-4 flex items-center space-x-4" key={alert.id}>
                {alert.type === "error" && (
                  <AlertCircleIcon className="h-6 w-6 text-red-500" />
                )}
                {alert.type === "warning" && (
                  <AlertCircleIcon className="h-6 w-6 text-yellow-500" />
                )}
                {alert.type === "info" && (
                  <BellIcon className="h-6 w-6 text-blue-500" />
                )}
                {alert.type === "success" && (
                  <CheckCircleIcon className="h-6 w-6 text-green-500" />
                )}
                <div>
                  <p className="font-medium">{alert.message}</p>
                  <p className="text-gray-500 text-sm">{alert.timestamp}</p>
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );

  const renderAdminContent = (tab: string) => {
    switch (tab) {
      case "overview":
        return renderAdminOverview();
      case "analytics":
        return renderAdminAnalytics();
      case "reports":
        return renderAdminReports();
      case "notifications":
        return renderAdminNotifications();
      default:
        return <div>{t("dashboard.emptyContent")}</div>;
    }
  };

  const renderPRContent = (tab: string) => {
    switch (tab) {
      case "overview":
        return (
          <>
            <BarChartCard
              className={cn(baseCardClasses, "col-span-2")}
              config={postEngagementConfig}
              data={filteredData.postEngagement}
              dataKeys={["likes", "comments", "shares"]}
              description={t("dashboard.cards.postEngagement.description")}
              title={t("dashboard.cards.postEngagement.title")}
              xAxisKey="name"
            />
            <LineChartCard
              className={baseCardClasses}
              config={audienceGrowthConfig}
              data={filteredData.audienceGrowth}
              dataKeys="followers"
              description={t("dashboard.cards.audienceGrowth.description")}
              title={t("dashboard.cards.audienceGrowth.title")}
              xAxisKey="date"
            />
          </>
        );
      default:
        return <div>{t("dashboard.emptyContent")}</div>;
    }
  };

  const renderFinanceContent = (tab: string) => {
    switch (tab) {
      case "overview":
        return (
          <>
            <BarChartCard
              className={cn(baseCardClasses, "col-span-2")}
              config={revenueConfig}
              data={filteredData.revenueByProduct}
              dataKeys="revenue"
              description={t("dashboard.cards.revenueByProduct.description")}
              title={t("dashboard.cards.revenueByProduct.title")}
              xAxisKey="name"
            />
            <PieChartCard
              className={baseCardClasses}
              config={expenseConfig}
              data={filteredData.expenseCategories}
              dataKey="amount"
              description={t("dashboard.cards.expenseCategories.description")}
              labelRenderer={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              nameKey="name"
              outerRadius={80}
              showLabels
              title={t("dashboard.cards.expenseCategories.title")}
            />
          </>
        );
      default:
        return <div>{t("dashboard.emptyContent")}</div>;
    }
  };

  const renderHRContent = (tab: string) => {
    switch (tab) {
      case "overview":
        return (
          <>
            <BarChartCard
              className={cn(baseCardClasses, "col-span-2")}
              config={jobApplicationsConfig}
              data={filteredData.jobApplications}
              dataKeys={["applications", "openPositions"]}
              description={t("dashboard.cards.jobApplications.description")}
              title={t("dashboard.cards.jobApplications.title")}
              xAxisKey="position"
            />
            <PieChartCard
              className={baseCardClasses}
              config={employeeConfig}
              data={employeeDistribution}
              dataKey="value"
              description={t(
                "dashboard.cards.employeeDistribution.description"
              )}
              labelRenderer={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              nameKey="name"
              outerRadius={80}
              showLabels
              title={t("dashboard.cards.employeeDistribution.title")}
            />
          </>
        );
      default:
        return <div>{t("dashboard.emptyContent")}</div>;
    }
  };

  return (
    <div className="space-y-8">
      <section className="surface-spotlight glass-panel relative overflow-hidden rounded-3xl border border-primary/10 px-6 py-6 accent-ring sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Badge
              className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 font-semibold text-[0.65rem] text-foreground uppercase tracking-[0.2em]"
              variant="outline"
            >
              {t("dashboard.hero.badge")}
            </Badge>
            <div className="space-y-2">
              <h1 className="font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">
                {t("dashboard.hero.title")}
              </h1>
              <p className="max-w-2xl text-muted-foreground text-sm sm:text-base">
                {t("dashboard.hero.description")}
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-2">
              {ROLE_OPTIONS.map((option) => {
                const isSelected = role === option.value;
                return (
                  <Button
                    className={cn(
                      "rounded-full border border-primary/10 bg-white/70 px-3 py-1 font-semibold text-foreground text-xs shadow-sm transition dark:bg-white/10",
                      isSelected &&
                        cn(
                          option.accent,
                          "shadow-[0_18px_40px_-25px_rgba(0,23,49,0.55)] hover:shadow-[0_18px_50px_-20px_rgba(0,23,49,0.45)]"
                        ),
                      !isSelected && "hover:bg-primary/5"
                    )}
                    key={option.value}
                    onClick={() => setRole(option.value)}
                    size="sm"
                    variant="ghost"
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-2 lg:w-auto">
            {summaryMetrics.map((metric) => (
              <div
                className="rounded-2xl border border-primary/10 bg-white/75 px-4 py-4 shadow-[0_22px_45px_-32px_rgba(0,23,49,0.5)] backdrop-blur dark:bg-white/5"
                key={metric.label}
              >
                <span className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
                  {metric.label}
                </span>
                <div className="mt-1 font-semibold text-foreground text-xl">
                  {metric.value}
                </div>
                <div className="text-muted-foreground text-xs">
                  {metric.description}
                </div>
                <span
                  className={cn(
                    "mt-1 inline-block font-semibold text-[11px]",
                    metric.badgeTone
                  )}
                >
                  {metric.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground text-lg">
              {t("dashboard.focus.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("dashboard.focus.description")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date Range Filter */}
            <div className="glass-panel flex gap-1 rounded-2xl border border-primary/10 bg-white/80 p-1">
              {DATE_RANGE_OPTIONS.map((option) => {
                const isSelected = dateRange === option.value;
                return (
                  <Button
                    className={cn(
                      "rounded-xl px-3 py-1.5 font-semibold text-xs transition",
                      isSelected && "bg-primary-40 text-white shadow-sm",
                      !isSelected && "text-muted-foreground hover:bg-primary/5"
                    )}
                    key={option.value}
                    onClick={() => setDateRange(option.value)}
                    size="sm"
                    variant="ghost"
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
            <Badge
              className="rounded-full border-primary/10 bg-primary/5 px-3 py-1 font-semibold text-[0.65rem] text-foreground uppercase tracking-[0.16em]"
              variant="outline"
            >
              {ROLE_OPTIONS.find((option) => option.value === role)?.label ??
                "Admin"}
            </Badge>
          </div>
        </div>
        <Tabs
          className="space-y-4"
          onValueChange={setActiveTab}
          value={activeTab}
        >
          <TabsList className="glass-panel flex flex-wrap gap-2 rounded-2xl border border-primary/10 bg-white/80 p-1">
            {SECTION_TABS.map((tab) => (
              <TabsTrigger
                className="rounded-xl px-3 py-1.5 font-semibold text-muted-foreground text-sm data-[state=active]:bg-primary-40 data-[state=active]:text-white data-[state=active]:shadow-[0_15px_30px_-25px_rgba(0,23,49,0.55)]"
                key={tab.value}
                value={tab.value}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SECTION_TABS.map((tab) => (
            <TabsContent
              className="space-y-4 focus-visible:outline-none"
              key={tab.value}
              value={tab.value}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {renderRoleSpecificContent(role, tab.value)}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );
}
