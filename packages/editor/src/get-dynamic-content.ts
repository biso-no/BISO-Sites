"use server";

import { fetchDynamicData } from "./data/fetch-data";
import type { DataSourceConfig, NormalizedItem } from "./data/types";

export type DynamicContentItem = {
  title: string;
  subtitle?: string;
  image?: string;
  href?: string;
  value?: string;
  label?: string;
  description?: string;
  date?: string;
  location?: string;
  category?: string;
  badge?: string;
  id?: string;
};

/**
 * Converts NormalizedItem to legacy DynamicContentItem format
 * This ensures backward compatibility with existing block implementations
 */
function toDynamicContentItem(item: NormalizedItem): DynamicContentItem {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    description: item.description,
    image: item.image,
    href: item.href,
    date: item.date,
    location: item.location,
    category: item.category,
    badge: item.badge,
    // Legacy fields for stats/counters
    value: item.metadata?.value as string,
    label: item.metadata?.label as string,
  };
}

/**
 * Fetch dynamic content from Appwrite based on source configuration
 * This is the main entry point for blocks using dynamic data
 */
export async function getDynamicContent(
  source:
    | DataSourceConfig
    | {
        table?: string;
        filters?: unknown[];
        operation?: string;
        limit?: number;
      }
): Promise<DynamicContentItem[]> {
  if (!source?.table) {
    return [];
  }

  // Convert legacy source format to DataSourceConfig
  const config: DataSourceConfig = {
    table: source.table,
    limit: source.limit,
    filters: source.filters?.map((f: unknown) => {
      const filter = f as { field: string; operator: string; value: unknown };
      return {
        field: filter.field,
        operator: filter.operator as
          | "equal"
          | "notEqual"
          | "lessThan"
          | "greaterThan"
          | "contains",
        value: filter.value,
      };
    }),
  };

  try {
    const result = await fetchDynamicData(config);
    return result.items.map(toDynamicContentItem);
  } catch (error) {
    console.error("[getDynamicContent] Failed to fetch:", error);
    return [];
  }
}
