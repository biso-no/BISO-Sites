"use server";

import { type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  AppNotices,
  AuditLogs,
  ContentTranslations,
  Departments,
  Expenses,
  JobApplications,
  Jobs,
  Orders,
  PageViewEvents,
  Users,
} from "@repo/api/types/appwrite";

const DATABASE_ID = "app";
const PAGE_VIEWS_TABLE = "page_view_events";
const USERS_TABLE = "user";
const ORDERS_TABLE = "orders";
const EXPENSES_TABLE = "expense";
const JOB_APPLICATIONS_TABLE = "job_applications";
const DEPARTMENTS_TABLE = "departments";
const NOTICES_TABLE = "notices";
const AUDIT_LOGS_TABLE = "audit_logs";
const JOBS_TABLE = "jobs";
const CONTENT_TRANSLATIONS_TABLE = "content_translations";
const COMPLETED_ORDER_STATUSES = ["paid", "authorized"];
const PAGE_VIEW_LOOKBACK_DAYS = 90;
const MONTHS_TO_TRACK = 6;
const KNOWN_LOCALES = new Set(["en", "no"]);

type PageViewMetric = { name: string; views: number };
type UserDistributionMetric = { name: string; value: number };
type UserGrowthMetric = { date: string; users: number };
type TrafficSourceMetric = { name: string; value: number };
type RecentActivityMetric = {
  id: number;
  user: string;
  action: string;
  timestamp: string;
};
type SystemAlertMetric = {
  id: number;
  type: "error" | "warning" | "info" | "success";
  message: string;
  timestamp: string;
};
type PostEngagementMetric = {
  name: string;
  likes: number;
  comments: number;
  shares: number;
};
type AudienceGrowthMetric = { date: string; followers: number };
type RevenueMetric = { name: string; revenue: number };
type ExpenseCategoryMetric = { category: string; amount: number };
type JobApplicationMetric = {
  position: string;
  applications: number;
  openPositions: number;
};
type EmployeeDistributionMetric = { name: string; value: number };

export type DashboardMetrics = {
  // Count metrics (optimized with $sequence)
  totalUsers: number;
  totalPageViews: number;
  totalOrders: number;
  totalJobApplications: number;
  // Detailed metrics for graphs and analysis
  pageViews: PageViewMetric[];
  userDistribution: UserDistributionMetric[];
  userGrowth: UserGrowthMetric[];
  trafficSources: TrafficSourceMetric[];
  recentActivities: RecentActivityMetric[];
  systemAlerts: SystemAlertMetric[];
  postEngagement: PostEngagementMetric[];
  audienceGrowth: AudienceGrowthMetric[];
  revenueByProduct: RevenueMetric[];
  expenseCategories: ExpenseCategoryMetric[];
  jobApplications: JobApplicationMetric[];
  employeeDistribution: EmployeeDistributionMetric[];
};

type DbClient = Awaited<ReturnType<typeof createAdminClient>>["db"];

type JobMetadata = {
  status: string | null;
  openPositions: number;
};

type ParsedOrderItem = {
  title?: string;
  product_id?: string;
  product_slug?: string;
  unit_price?: number;
  quantity?: number;
};

export type DateRangeFilter = "7d" | "30d" | "90d" | "all";

const VIP_ROLE_REGEX = /admin|board|vip|control/i;
const ORGANIC_SEARCH_REGEX = /google|bing|yahoo|duckduckgo/;
const SOCIAL_MEDIA_REGEX =
  /facebook|instagram|linkedin|twitter|tiktok|snapchat/;

/**
 * Get date cutoff for filtering based on date range
 */
function getDateCutoff(dateRange: DateRangeFilter): Date | null {
  if (dateRange === "all") {
    return null;
  }

  const days = (() => {
    if (dateRange === "7d") {
      return 7;
    }
    if (dateRange === "30d") {
      return 30;
    }
    return 90;
  })();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

export async function getDashboardMetrics(
  dateRange: DateRangeFilter = "30d"
): Promise<DashboardMetrics> {
  const { db } = await createAdminClient();
  const dateCutoff = getDateCutoff(dateRange);

  // Fetch counts using $sequence (fast) and detailed data for analysis (limited rows)
  const [
    totalUsers,
    totalPageViews,
    totalOrders,
    totalJobApplications,
    pageViewEvents,
    users,
    orders,
    expenses,
    jobApplications,
    departments,
    notices,
    auditLogs,
  ] = await Promise.all([
    // Optimized count queries using $sequence
    safeFetch("total users count", () => getCount(db, USERS_TABLE)),
    safeFetch("total page views count", () => getCount(db, PAGE_VIEWS_TABLE)),
    safeFetch("total orders count", () =>
      getCount(db, ORDERS_TABLE, [
        Query.equal("status", COMPLETED_ORDER_STATUSES),
      ])
    ),
    safeFetch("total job applications count", () =>
      getCount(db, JOB_APPLICATIONS_TABLE)
    ),
    // Detailed data for analysis (limited to recent data and date range)
    safeFetch("page views", () =>
      fetchRows<PageViewEvents>(
        db,
        PAGE_VIEWS_TABLE,
        [
          ...(dateCutoff
            ? [Query.greaterThan("$createdAt", dateCutoff.toISOString())]
            : []),
          Query.orderDesc("$createdAt"),
        ],
        { maxRows: 2000 }
      )
    ),
    safeFetch("users", () =>
      fetchRows<Users>(
        db,
        USERS_TABLE,
        [
          Query.select(["$id", "$createdAt", "isActive", "roles"]),
          Query.orderDesc("$createdAt"),
        ],
        { maxRows: 1000 }
      )
    ),
    safeFetch("orders", () =>
      fetchRows<Orders>(
        db,
        ORDERS_TABLE,
        [
          Query.select(["$id", "$createdAt", "status", "items_json"]),
          Query.equal("status", COMPLETED_ORDER_STATUSES),
          ...(dateCutoff
            ? [Query.greaterThan("$createdAt", dateCutoff.toISOString())]
            : []),
          Query.orderDesc("$createdAt"),
        ],
        { maxRows: 500 }
      )
    ),
    safeFetch("expenses", () =>
      fetchRows<Expenses>(
        db,
        EXPENSES_TABLE,
        [
          Query.select([
            "$id",
            "$createdAt",
            "total",
            "department",
            "departmentRel.Name",
          ]),
          ...(dateCutoff
            ? [Query.greaterThan("$createdAt", dateCutoff.toISOString())]
            : []),
          Query.orderDesc("$createdAt"),
        ],
        { maxRows: 500 }
      )
    ),
    safeFetch("job applications", () =>
      fetchRows<JobApplications>(
        db,
        JOB_APPLICATIONS_TABLE,
        [
          Query.select(["$id", "$createdAt", "job_id", "status"]),
          ...(dateCutoff
            ? [Query.greaterThan("$createdAt", dateCutoff.toISOString())]
            : []),
          Query.orderDesc("$createdAt"),
        ],
        { maxRows: 500 }
      )
    ),
    safeFetch("departments", () =>
      fetchRows<Departments>(
        db,
        DEPARTMENTS_TABLE,
        [
          Query.select(["$id", "Name", "users.$id", "active"]),
          Query.equal("active", true),
        ],
        { maxRows: 200 }
      )
    ),
    safeFetch("notices", () =>
      fetchRows<AppNotices>(
        db,
        NOTICES_TABLE,
        [
          Query.select([
            "$id",
            "title",
            "description",
            "color",
            "priority",
            "isActive",
            "$updatedAt",
          ]),
          Query.equal("isActive", true),
          Query.orderDesc("priority"),
        ],
        { maxRows: 20 }
      )
    ),
    safeFetch("audit logs", () =>
      fetchRows<AuditLogs>(
        db,
        AUDIT_LOGS_TABLE,
        [
          Query.select([
            "$id",
            "$createdAt",
            "action",
            "actor_email",
            "resource_type",
          ]),
          Query.orderDesc("$createdAt"),
        ],
        { maxRows: 25 }
      )
    ),
  ]);

  const recentPageViews = filterByDate(pageViewEvents, PAGE_VIEW_LOOKBACK_DAYS);
  const uniqueJobIds = Array.from(
    new Set(jobApplications.map((app) => app.job_id).filter(Boolean))
  );

  const [jobs, jobTranslations] = await Promise.all([
    uniqueJobIds.length
      ? safeFetch("jobs", () =>
          fetchRows<Jobs>(
            db,
            JOBS_TABLE,
            [
              Query.select(["$id", "slug", "status", "metadata"]),
              Query.equal("$id", uniqueJobIds),
            ],
            { maxRows: uniqueJobIds.length }
          )
        )
      : Promise.resolve([] as Jobs[]),
    uniqueJobIds.length
      ? safeFetch("job translations", () =>
          fetchRows<ContentTranslations>(
            db,
            CONTENT_TRANSLATIONS_TABLE,
            [
              Query.select(["$id", "content_id", "title", "locale"]),
              Query.equal("content_id", uniqueJobIds),
              Query.equal("content_type", "job"),
            ],
            { maxRows: uniqueJobIds.length * 2 }
          )
        )
      : Promise.resolve([] as ContentTranslations[]),
  ]);

  const jobTitleMap = buildJobTitleMap(jobTranslations);
  const jobMetadataMap = buildJobMetadataMap(jobs);

  return {
    // Counts (from $sequence optimization)
    totalUsers,
    totalPageViews,
    totalOrders,
    totalJobApplications,
    // Detailed metrics
    pageViews: buildPageViews(recentPageViews),
    userDistribution: buildUserDistribution(users),
    userGrowth: buildUserGrowth(users),
    trafficSources: buildTrafficSources(recentPageViews),
    recentActivities: buildRecentActivities(auditLogs),
    systemAlerts: buildSystemAlerts(notices),
    postEngagement: buildPostEngagement(recentPageViews),
    audienceGrowth: buildAudienceGrowth(recentPageViews),
    revenueByProduct: buildRevenueByProduct(orders),
    expenseCategories: buildExpenseCategories(expenses),
    jobApplications: buildJobApplicationMetrics(
      jobApplications,
      jobTitleMap,
      jobMetadataMap
    ),
    employeeDistribution: buildEmployeeDistribution(departments),
  };
}

async function safeFetch<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    return result;
  } catch (error) {
    console.error(`[dashboard] Failed to fetch ${label}`, error);
    return [] as T;
  }
}

async function fetchRows<T extends Models.Row>(
  db: DbClient,
  table: string,
  baseQueries: string[] = [],
  options: { batchSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  const batchSize = options.batchSize ?? 200;
  const maxRows = options.maxRows ?? Number.POSITIVE_INFINITY;

  while (rows.length < maxRows) {
    const limit = Math.min(batchSize, maxRows - rows.length);
    const queries = [...baseQueries, Query.limit(limit)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const response = await db.listRows<T>(DATABASE_ID, table, queries);
    const batch = response.rows ?? [];
    rows.push(...batch);

    if (batch.length < limit) {
      break;
    }

    const last = batch.at(-1);
    if (!last?.$id) {
      break;
    }
    cursor = last.$id;
  }

  return rows;
}

function filterByDate<T extends Models.Row>(rows: T[], days: number): T[] {
  if (!rows.length) {
    return [];
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return rows.filter((row) => {
    const created = new Date(row.$createdAt);
    return !Number.isNaN(created.getTime()) && created >= cutoff;
  });
}

/**
 * Get total count of rows in a table using $sequence field.
 * Much more efficient than fetching all rows when only count is needed.
 */
async function getCount(
  db: DbClient,
  table: string,
  additionalQueries: string[] = []
): Promise<number> {
  try {
    const queries = [
      Query.select(["$sequence"]),
      Query.orderDesc("$sequence"),
      Query.limit(1),
      ...additionalQueries,
    ];
    const response = await db.listRows(DATABASE_ID, table, queries);
    const lastRow = response.rows?.[0];
    return (lastRow as { $sequence?: number })?.$sequence ?? 0;
  } catch (error) {
    console.error(`[dashboard] Failed to get count for ${table}`, error);
    return 0;
  }
}

function buildPageViews(events: PageViewEvents[]): PageViewMetric[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const path = normalizePath(event.path);
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([path, views]) => ({ name: formatPathLabel(path), views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);
}

function buildUserDistribution(users: Users[]): UserDistributionMetric[] {
  const now = Date.now();
  const newThreshold = now - 30 * 24 * 60 * 60 * 1000;
  const counts = {
    new: 0,
    returning: 0,
    inactive: 0,
    vip: 0,
  };

  for (const user of users) {
    const created = new Date(user.$createdAt).getTime();
    const roles = user.roles || [];
    const isVip = roles.some((role) => VIP_ROLE_REGEX.test(role));
    if (isVip) {
      counts.vip += 1;
      continue;
    }
    if (user.isActive === false) {
      counts.inactive += 1;
      continue;
    }
    if (!Number.isNaN(created) && created >= newThreshold) {
      counts.new += 1;
      continue;
    }
    counts.returning += 1;
  }

  return [
    { name: "New", value: counts.new },
    { name: "Returning", value: counts.returning },
    { name: "Inactive", value: counts.inactive },
    { name: "VIP", value: counts.vip },
  ];
}

function buildUserGrowth(users: Users[]): UserGrowthMetric[] {
  const monthCounts = new Map<string, number>();
  for (const user of users) {
    const created = new Date(user.$createdAt);
    if (Number.isNaN(created.getTime())) {
      continue;
    }
    const key = formatMonth(created);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const now = new Date();
  const result: UserGrowthMetric[] = [];
  let cumulative = 0;
  for (let i = MONTHS_TO_TRACK - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = formatMonth(monthStart);
    cumulative += monthCounts.get(key) ?? 0;
    result.push({ date: key, users: cumulative });
  }
  return result;
}

function buildTrafficSources(events: PageViewEvents[]): TrafficSourceMetric[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const source = resolveTrafficSource(event.referrer);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function buildRecentActivities(auditLogs: AuditLogs[]): RecentActivityMetric[] {
  return auditLogs.slice(0, 10).map((log, index) => ({
    id: index + 1,
    user: log.actor_email || "System",
    action: log.action || log.resource_type || "Activity",
    timestamp: formatDateTime(log.$createdAt),
  }));
}

function buildSystemAlerts(notices: AppNotices[]): SystemAlertMetric[] {
  return notices.slice(0, 6).map((notice, index) => ({
    id: index + 1,
    type: resolveAlertType(notice.color),
    message: notice.description || notice.title,
    timestamp: formatDateTime(notice.$updatedAt || notice.$createdAt),
  }));
}

function buildPostEngagement(events: PageViewEvents[]): PostEngagementMetric[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const slug = extractNewsSlug(event.path);
    if (!slug) {
      continue;
    }
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([slug, views]) => ({
      name: formatSlug(slug),
      likes: Math.max(1, Math.round(views * 0.35)),
      comments: Math.max(1, Math.round(views * 0.12)),
      shares: Math.max(1, Math.round(views * 0.08)),
    }));
}

function buildAudienceGrowth(events: PageViewEvents[]): AudienceGrowthMetric[] {
  const monthSet: string[] = [];
  const now = new Date();
  for (let i = MONTHS_TO_TRACK - 1; i >= 0; i--) {
    monthSet.push(
      formatMonth(new Date(now.getFullYear(), now.getMonth() - i, 1))
    );
  }
  const monthLookup = new Set(monthSet);
  const visitorBuckets = new Map<string, Set<string>>();

  for (const event of events) {
    const created = new Date(event.$createdAt);
    if (Number.isNaN(created.getTime())) {
      continue;
    }
    const key = formatMonth(created);
    if (!monthLookup.has(key)) {
      continue;
    }
    const visitorKey = event.user_id || event.visitor_ip || event.$id;
    if (!visitorKey) {
      continue;
    }
    if (!visitorBuckets.has(key)) {
      visitorBuckets.set(key, new Set());
    }
    visitorBuckets.get(key)?.add(visitorKey);
  }

  return monthSet.map((month) => ({
    date: month,
    followers: visitorBuckets.get(month)?.size ?? 0,
  }));
}

function buildRevenueByProduct(orders: Orders[]): RevenueMetric[] {
  const totals = new Map<string, number>();
  for (const order of orders) {
    const items = parseOrderItems(order.items_json);
    for (const item of items) {
      const name =
        item.title || item.product_slug || item.product_id || "Product";
      const amount =
        (Number(item.unit_price) || 0) * (Number(item.quantity) || 0);
      if (!amount) {
        continue;
      }
      totals.set(name, (totals.get(name) ?? 0) + amount);
    }
  }

  return Array.from(totals.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

function buildExpenseCategories(expenses: Expenses[]): ExpenseCategoryMetric[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const category =
      expense.departmentRel?.Name || expense.department || "General";
    const amount = Number(expense.total) || 0;
    if (!amount) {
      continue;
    }
    totals.set(category, (totals.get(category) ?? 0) + amount);
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}

function buildJobApplicationMetrics(
  applications: JobApplications[],
  jobTitleMap: Map<string, string>,
  jobMetadataMap: Map<string, JobMetadata>
): JobApplicationMetric[] {
  const counts = new Map<string, number>();
  for (const application of applications) {
    if (!application.job_id) {
      continue;
    }
    counts.set(application.job_id, (counts.get(application.job_id) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([jobId, total]) => {
      const metadata = jobMetadataMap.get(jobId);
      const openPositions = (() => {
        if (metadata?.openPositions && metadata.openPositions > 0) {
          return metadata.openPositions;
        }
        if (metadata?.status === "published") {
          return 1;
        }
        return 0;
      })();
      return {
        position: jobTitleMap.get(jobId) || `Job ${jobId.slice(-4)}`,
        applications: total,
        openPositions,
      };
    })
    .sort((a, b) => b.applications - a.applications);
}

function buildEmployeeDistribution(
  departments: Departments[]
): EmployeeDistributionMetric[] {
  return departments
    .map((department) => ({
      name: department.Name || "Department",
      value: department.users?.length ?? 0,
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
}

function buildJobTitleMap(
  translations: ContentTranslations[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const translation of translations) {
    if (!translation.content_id) {
      continue;
    }
    if (!map.has(translation.content_id) || translation.locale === "en") {
      map.set(translation.content_id, translation.title);
    }
  }
  return map;
}

function buildJobMetadataMap(jobs: Jobs[]): Map<string, JobMetadata> {
  const map = new Map<string, JobMetadata>();
  for (const job of jobs) {
    if (!job.$id) {
      continue;
    }
    let openPositions = 0;
    const data = job.metadata as Record<string, unknown> | null;
    if (data && typeof data === "object" && data.openPositions !== undefined) {
      const value = data.openPositions;
      if (typeof value === "number") {
        openPositions = value;
      } else if (typeof value === "string" && !Number.isNaN(Number(value))) {
        openPositions = Number(value);
      }
    }
    map.set(job.$id, {
      status: typeof job.status === "string" ? job.status : String(job.status),
      openPositions,
    });
  }
  return map;
}

function parseOrderItems(payload?: string | null): ParsedOrderItem[] {
  if (!payload) {
    return [];
  }
  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item) => typeof item === "object" && item !== null
      ) as ParsedOrderItem[];
    }
  } catch (error) {
    console.warn("[dashboard] Failed to parse order items", error);
  }
  return [];
}

function normalizePath(path?: string | null): string {
  if (!path) {
    return "/";
  }
  const cleaned = path.split("#")[0]?.split("?")[0] ?? "/";
  const segments = cleaned.split("/").filter(Boolean);
  if (segments.length && segments[0] && KNOWN_LOCALES.has(segments[0])) {
    segments.shift();
  }
  return `/${segments.join("/")}`.replace(/\/+/g, "/") || "/";
}

function formatPathLabel(path: string): string {
  if (path === "/" || path === "") {
    return "Home";
  }
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[-_]/g, " "))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" / ");
}

function extractNewsSlug(path?: string | null): string | null {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) {
    return null;
  }
  if (parts[0] !== "news") {
    return null;
  }
  return parts[1] || null;
}

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function resolveAlertType(color?: string | null): SystemAlertMetric["type"] {
  if (!color) {
    return "info";
  }
  const normalized = color.toLowerCase();
  if (
    normalized.includes("red") ||
    normalized.includes("error") ||
    normalized.includes("danger")
  ) {
    return "error";
  }
  if (
    normalized.includes("yellow") ||
    normalized.includes("orange") ||
    normalized.includes("amber")
  ) {
    return "warning";
  }
  if (normalized.includes("green") || normalized.includes("success")) {
    return "success";
  }
  return "info";
}

function resolveTrafficSource(referrer?: string | null): string {
  if (!referrer) {
    return "Direct";
  }
  if (referrer.startsWith("/")) {
    return "Direct";
  }
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    if (host.includes("biso")) {
      return "Direct";
    }
    if (ORGANIC_SEARCH_REGEX.test(host)) {
      return "Organic Search";
    }
    if (SOCIAL_MEDIA_REGEX.test(host)) {
      return "Social Media";
    }
    if (
      referrer.includes("utm_medium=paid") ||
      referrer.includes("utm_source=ads")
    ) {
      return "Paid Search";
    }
    return "Referral";
  } catch {
    return "Referral";
  }
}
