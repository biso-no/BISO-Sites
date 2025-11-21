"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";

const DATABASE_ID = "app";
const METRICS_TABLE = "dashboard_metrics";

export type DateRange = "7d" | "30d" | "90d" | "all";

export type MetricType =
  | "user_distribution"
  | "traffic_sources"
  | "revenue_by_product"
  | "expense_categories"
  | "post_engagement";

/**
 * Stored metric data structure
 */
export interface StoredMetric {
  metric_type: MetricType;
  metric_data: string; // JSON stringified data
  date_range: DateRange;
  computed_at: string; // ISO datetime
}

/**
 * Get a cached metric from the dashboard_metrics table
 *
 * @example
 * const metric = await getCachedMetric('traffic_sources', '30d')
 * const data = JSON.parse(metric.metric_data)
 */
export async function getCachedMetric(
  metricType: MetricType,
  dateRange: DateRange
): Promise<StoredMetric | null> {
  try {
    const { db } = await createAdminClient();
    const response = await db.listRows(DATABASE_ID, METRICS_TABLE, [
      Query.equal("metric_type", metricType),
      Query.equal("date_range", dateRange),
      Query.orderDesc("computed_at"),
      Query.limit(1),
    ]);

    const row = response.rows?.[0];
    if (!row) {
      return null;
    }

    return {
      metric_type: row.metric_type as MetricType,
      metric_data: row.metric_data as string,
      date_range: row.date_range as DateRange,
      computed_at: row.computed_at as string,
    };
  } catch (error) {
    console.error(
      `[dashboard-metrics] Failed to get cached metric ${metricType}:${dateRange}`,
      error
    );
    return null;
  }
}

/**
 * Store or update a metric in the dashboard_metrics table
 *
 * @example
 * const trafficData = [
 *   { name: 'Organic Search', value: 1234 },
 *   { name: 'Social Media', value: 567 },
 * ]
 * await storeCachedMetric('traffic_sources', '30d', trafficData)
 */
export async function storeCachedMetric(
  metricType: MetricType,
  dateRange: DateRange,
  data: unknown
): Promise<void> {
  try {
    const { db } = await createAdminClient();

    // Create new metric entry
    await db.createRow(DATABASE_ID, METRICS_TABLE, ID.unique(), {
      metric_type: metricType,
      metric_data: JSON.stringify(data),
      date_range: dateRange,
      computed_at: new Date().toISOString(),
    });

    console.log(`[dashboard-metrics] Stored metric ${metricType}:${dateRange}`);
  } catch (error) {
    console.error(
      `[dashboard-metrics] Failed to store metric ${metricType}:${dateRange}`,
      error
    );
    throw error;
  }
}

/**
 * Check if a cached metric is stale (older than threshold)
 *
 * @param metric The metric to check
 * @param maxAgeMinutes Maximum age in minutes before considering stale
 * @returns true if the metric should be recomputed
 */
export function isMetricStale(
  metric: StoredMetric | null,
  maxAgeMinutes: number = 60
): boolean {
  if (!metric) {
    return true;
  }

  const computedAt = new Date(metric.computed_at);
  const now = new Date();
  const ageMinutes = (now.getTime() - computedAt.getTime()) / (1000 * 60);

  return ageMinutes > maxAgeMinutes;
}

/**
 * Example: Get or compute a metric with caching
 *
 * @example
 * const trafficSources = await getOrComputeMetric(
 *   'traffic_sources',
 *   '30d',
 *   async () => {
 *     // Expensive computation here
 *     const events = await fetchPageViewEvents()
 *     return computeTrafficSources(events)
 *   }
 * )
 */
export async function getOrComputeMetric<T>(
  metricType: MetricType,
  dateRange: DateRange,
  computeFn: () => Promise<T>,
  maxAgeMinutes: number = 60
): Promise<T> {
  const cached = await getCachedMetric(metricType, dateRange);

  if (!isMetricStale(cached, maxAgeMinutes)) {
    return JSON.parse(cached!.metric_data) as T;
  }

  // Compute fresh data
  const freshData = await computeFn();

  // Store in cache
  await storeCachedMetric(metricType, dateRange, freshData);

  return freshData;
}
