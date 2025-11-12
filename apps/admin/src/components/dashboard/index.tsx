"use client"

import { useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { BellIcon, AlertCircleIcon, CheckCircleIcon } from "lucide-react"
import { Badge } from "@repo/ui/components/ui/badge"
import { Button } from "@repo/ui/components/ui/button"
import { cn } from '@repo/ui/lib/utils'

const COLORS = ["#004797", "#3DA9E0", "#F7D64A", "#82ca9d", "#FF8042", "#8884D8"]

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", accent: "bg-primary-40 text-white" },
  { value: "pr", label: "PR & Communication", accent: "bg-secondary-100/80 text-primary-100" },
  { value: "finance", label: "Finance", accent: "bg-gold-default/80 text-primary-100" },
  { value: "hr", label: "HR", accent: "bg-primary-10/70 text-primary-100" },
]

const SECTION_TABS = [
  { value: "overview", label: "Overview" },
  { value: "analytics", label: "Analytics" },
  { value: "reports", label: "Reports" },
  { value: "notifications", label: "Notifications" },
]

const formatNumber = (value: number) => {
  if (value === undefined || value === null) return "0"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString()
}

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return "0%"
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

export default function AdminDashboard({ 
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
  employeeDistribution
}) {
  const [role, setRole] = useState("admin")
  const [activeTab, setActiveTab] = useState("overview")

  const totalPageViews = pageViews.reduce((sum, page) => sum + page.views, 0)
  const topPage = pageViews.reduce((best, current) => current.views > (best?.views ?? 0) ? current : best, pageViews[0] ?? null)
  const totalUsers = userGrowth[userGrowth.length - 1]?.users ?? 0
  const previousUsers = userGrowth[userGrowth.length - 2]?.users ?? totalUsers
  const userGrowthRate = previousUsers > 0 ? ((totalUsers - previousUsers) / previousUsers) * 100 : 0
  const topTrafficSource = trafficSources.reduce((best, current) => current.value > (best?.value ?? 0) ? current : best, trafficSources[0] ?? null)
  const alertCounts = systemAlerts.reduce(
    (acc, alert) => {
      acc[alert.type] = (acc[alert.type] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const totalAlerts = systemAlerts.length
  const totalRevenue = revenueByProduct.reduce((sum, product) => sum + product.revenue, 0)
  const totalApplications = jobApplications.reduce((sum, job) => sum + job.applications, 0)
  const openPositions = jobApplications.reduce((sum, job) => sum + (job.openPositions ?? 0), 0)

  const summaryMetrics = useMemo(() => [
    {
      label: "Total page views",
      value: formatNumber(totalPageViews),
      description: topPage ? `Top page • ${topPage.name}` : "No top page data",
      badge: formatPercent(userGrowthRate),
      badgeTone: userGrowthRate >= 0 ? "text-emerald-500" : "text-red-500",
    },
    {
      label: "Active members",
      value: formatNumber(totalUsers),
      description: "Community reach",
      badge: `${userDistribution.length} segments`,
      badgeTone: "text-primary-50",
    },
    {
      label: "System alerts",
      value: formatNumber(totalAlerts),
      description: "Across all severities",
      badge: `${alertCounts.error ?? 0} critical`,
      badgeTone: (alertCounts.error ?? 0) > 0 ? "text-red-500" : "text-secondary-100",
    },
    {
      label: "Job pipeline",
      value: formatNumber(totalApplications),
      description: `${openPositions} open roles`,
      badge: topTrafficSource ? `Traffic: ${topTrafficSource.name}` : "Tracking",
      badgeTone: "text-primary-60",
    },
  ], [totalPageViews, topPage, userGrowthRate, totalUsers, userDistribution.length, totalAlerts, alertCounts.error, totalApplications, openPositions, topTrafficSource])

  const baseCardClasses = "glass-panel border border-primary/10 bg-white/80 shadow-[0_25px_45px_-30px_rgba(0,23,49,0.3)]"

  const renderRoleSpecificContent = (currentRole: string, tab: string) => {
    switch (currentRole) {
      case "admin":
        return renderAdminContent(tab)
      case "pr":
        return renderPRContent(tab)
      case "finance":
        return renderFinanceContent(tab)
      case "hr":
        return renderHRContent(tab)
      default:
        return <div>No specific content for this role</div>
    }
  }

  const renderAdminContent = (tab) => {
    switch (tab) {
      case "overview":
        return (
          <>
            <Card className={cn(baseCardClasses, "col-span-2")}>
              <CardHeader>
                <CardTitle>Page Views</CardTitle>
                <CardDescription>Overview of page views across the website</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pageViews}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="views" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle>User Distribution</CardTitle>
                <CardDescription>Breakdown of user types</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={userDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {userDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className={cn(baseCardClasses, "col-span-3")}>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>Monthly user growth over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )
      case "analytics":
        return (
          <>
            {/* High-level analytics cards */}
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle>Total Page Views</CardTitle>
                <CardDescription>Aggregate across all tracked pages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalPageViews.toLocaleString()}</div>
                {topPage ? (
                  <div className="text-sm text-muted-foreground">Top page: {topPage.name}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">No page data available</div>
                )}
              </CardContent>
            </Card>
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>Month-over-month change</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalUsers.toLocaleString()}</div>
                <div className={`text-sm ${userGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {userGrowthRate >= 0 ? '+' : ''}{userGrowthRate.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle>Top Traffic Source</CardTitle>
                <CardDescription>Leading channel this period</CardDescription>
              </CardHeader>
              <CardContent>
                {topTrafficSource ? (
                  <>
                    <div className="text-3xl font-bold">{topTrafficSource.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {topTrafficSource.value.toLocaleString()} sessions
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No traffic data available</div>
                )}
              </CardContent>
            </Card>

            {/* Traffic Source Breakdown */}
            <Card className={cn(baseCardClasses, "col-span-2")}>
              <CardHeader>
                <CardTitle>Traffic Source Breakdown</CardTitle>
                <CardDescription>Where your visitors are coming from</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={trafficSources}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {trafficSources.map((entry, index) => (
                        <Cell key={`traffic-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )
      case "reports":
        return (
          <Card className={cn(baseCardClasses, "col-span-3")}>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Latest actions performed by users</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Timestamp</TableHead>
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
        )
      case "notifications":
        return (
          <>
            {/* Alert Summary Cards */}
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircleIcon className="h-5 w-5 text-red-500" />
                  Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{alertCounts.error ?? 0}</div>
                <div className="text-sm text-gray-600">Require immediate attention</div>
              </CardContent>
            </Card>
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BellIcon className="h-5 w-5 text-yellow-500" />
                  Warnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">{alertCounts.warning ?? 0}</div>
                <div className="text-sm text-gray-600">Monitor these items</div>
              </CardContent>
            </Card>
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BellIcon className="h-5 w-5 text-blue-500" />
                  Info Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{alertCounts.info ?? 0}</div>
                <div className="text-sm text-gray-600">General system updates</div>
              </CardContent>
            </Card>
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  Success Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{alertCounts.success ?? 0}</div>
                <div className="text-sm text-gray-600">Completed tasks</div>
              </CardContent>
            </Card>

            {/* System Alerts */}
            <Card className={cn(baseCardClasses, "col-span-1")}>
              <CardHeader>
                <CardTitle>System Alerts</CardTitle>
                <CardDescription>Application and platform notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {systemAlerts.map((alert) => (
                    <div key={alert.id} className="mb-4 flex items-center space-x-4">
                      {alert.type === "error" && <AlertCircleIcon className="h-6 w-6 text-red-500" />}
                      {alert.type === "warning" && <AlertCircleIcon className="h-6 w-6 text-yellow-500" />}
                      {alert.type === "info" && <BellIcon className="h-6 w-6 text-blue-500" />}
                      {alert.type === "success" && <CheckCircleIcon className="h-6 w-6 text-green-500" />}
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-sm text-gray-500">{alert.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )
      default:
        return <div>No content for this tab</div>
    }
  }

  const renderPRContent = (tab) => {
    switch (tab) {
      case "overview":
        return (
          <>
            <Card className={cn(baseCardClasses, "col-span-2")}>
              <CardHeader>
                <CardTitle>Post Engagement</CardTitle>
                <CardDescription>Overview of likes, comments, and shares for recent posts</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={postEngagement}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="likes" fill="#8884d8" />
                    <Bar dataKey="comments" fill="#82ca9d" />
                    <Bar dataKey="shares" fill="#ffc658" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle>Audience Growth</CardTitle>
                <CardDescription>Monthly follower growth</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={audienceGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="followers" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )
      // ... (other tabs for PR role)
      default:
        return <div>No content for this tab</div>
    }
  }

  const renderFinanceContent = (tab) => {
    switch (tab) {
      case "overview":
        return (
          <>
            <Card className={cn(baseCardClasses, "col-span-2")}>
              <CardHeader>
                <CardTitle>Revenue by Product</CardTitle>
                <CardDescription>Overview of revenue generated by each product</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByProduct}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle>Expense Categories</CardTitle>
                <CardDescription>Breakdown of expenses by category</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategories}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                      label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                    >
                      {expenseCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )
      // ... (other tabs for Finance role)
      default:
        return <div>No content for this tab</div>
    }
  }

  const renderHRContent = (tab) => {
    switch (tab) {
      case "overview":
        return (
          <>
            <Card className={cn(baseCardClasses, "col-span-2")}>
              <CardHeader>
                <CardTitle>Job Applications</CardTitle>
                <CardDescription>Number of applications per open position</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jobApplications}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="applications" fill="#8884d8" />
                    <Bar yAxisId="right" dataKey="openPositions" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className={baseCardClasses}>
              <CardHeader>
                <CardTitle>Employee Distribution</CardTitle>
                <CardDescription>Breakdown of employees by department</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={employeeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {employeeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )
      // ... (other tabs for HR role)
      default:
        return <div>No content for this tab</div>
    }
  }

  return (
    <div className="space-y-8">
      <section className="surface-spotlight glass-panel accent-ring relative overflow-hidden rounded-3xl border border-primary/10 px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary-70">
              Admin intelligence
            </Badge>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-primary-100 sm:text-3xl">Unified control center</h1>
              <p className="max-w-2xl text-sm text-primary-60 sm:text-base">
                Monitor growth, engagement, finance, and people analytics from a single premium workspace tuned for BISO.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-2">
              {ROLE_OPTIONS.map((option) => {
                const isSelected = role === option.value
                return (
                  <Button
                    key={option.value}
                    size="sm"
                    variant="ghost"
                    onClick={() => setRole(option.value)}
                    className={cn(
                      "rounded-full border border-primary/10 bg-white/70 px-3 py-1 text-xs font-semibold text-primary-80 shadow-sm transition",
                      isSelected && cn(option.accent, "shadow-[0_18px_40px_-25px_rgba(0,23,49,0.55)] hover:shadow-[0_18px_50px_-20px_rgba(0,23,49,0.45)]"),
                      !isSelected && "hover:bg-primary/5"
                    )}
                  >
                    {option.label}
                  </Button>
                )
              })}
            </div>
          </div>
          <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-2 lg:w-auto">
            {summaryMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-primary/10 bg-white/75 px-4 py-4 shadow-[0_22px_45px_-32px_rgba(0,23,49,0.5)] backdrop-blur">
                <span className="text-xs uppercase tracking-[0.18em] text-primary-50">{metric.label}</span>
                <div className="mt-1 text-xl font-semibold text-primary-100">{metric.value}</div>
                <div className="text-xs text-primary-60">{metric.description}</div>
                <span className={cn("mt-1 inline-block text-[11px] font-semibold", metric.badgeTone)}>
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
            <h2 className="text-lg font-semibold text-primary-100">Focus areas</h2>
            <p className="text-sm text-primary-60">Switch between analytic lenses tailored to your current role.</p>
          </div>
          <Badge variant="outline" className="rounded-full border-primary/10 bg-primary/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary-70">
            {ROLE_OPTIONS.find((option) => option.value === role)?.label ?? "Admin"}
          </Badge>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="glass-panel flex flex-wrap gap-2 rounded-2xl border border-primary/10 bg-white/80 p-1">
            {SECTION_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-primary-60 data-[state=active]:bg-primary-40 data-[state=active]:text-white data-[state=active]:shadow-[0_15px_30px_-25px_rgba(0,23,49,0.55)]"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SECTION_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="space-y-4 focus-visible:outline-none">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {renderRoleSpecificContent(role, tab.value)}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  )
}
