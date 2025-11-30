"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { normalizeItem } from "./normalizers";
import type {
  DataFetchResult,
  DataFilter,
  DataSourceConfig,
  FilterOperator,
  NormalizedItem,
} from "./types";

const DATABASE_ID = "app";

/** Map of table names to their Appwrite collection IDs */
const TABLE_COLLECTION_MAP: Record<string, string> = {
  events: "events",
  news: "news",
  jobs: "jobs",
  partners: "partners",
  departments: "departments",
  team: "departmentBoard",
  products: "webshop_products",
  memberships: "memberships",
  pages: "pages",
};

/** Map operators to Appwrite Query methods */
function buildQuery(filter: DataFilter): string | null {
  const { field, operator, value } = filter;

  // Handle special values
  const resolvedValue = value === "$now" ? new Date().toISOString() : value;

  const operatorMap: Record<FilterOperator, () => string | null> = {
    equal: () => Query.equal(field, resolvedValue as string | number | boolean),
    notEqual: () =>
      Query.notEqual(field, resolvedValue as string | number | boolean),
    lessThan: () => Query.lessThan(field, resolvedValue as string | number),
    lessThanOrEqual: () =>
      Query.lessThanEqual(field, resolvedValue as string | number),
    greaterThan: () =>
      Query.greaterThan(field, resolvedValue as string | number),
    greaterThanOrEqual: () =>
      Query.greaterThanEqual(field, resolvedValue as string | number),
    contains: () => Query.contains(field, resolvedValue as string),
    startsWith: () => Query.startsWith(field, resolvedValue as string),
    endsWith: () => Query.endsWith(field, resolvedValue as string),
    isNull: () => Query.isNull(field),
    isNotNull: () => Query.isNotNull(field),
  };

  const queryBuilder = operatorMap[operator];
  return queryBuilder ? queryBuilder() : null;
}

/**
 * Fetch data from Appwrite based on DataSourceConfig
 * This is the main function used by Puck's resolveData
 */
export async function fetchDynamicData(
  config: DataSourceConfig
): Promise<DataFetchResult> {
  if (!config?.table) {
    return { items: [], total: 0, hasMore: false };
  }

  try {
    const { db } = await createAdminClient();
    const collectionId = TABLE_COLLECTION_MAP[config.table] || config.table;

    // Build queries
    const queries: string[] = [];

    // Add filters
    if (config.filters?.length) {
      for (const filter of config.filters) {
        const query = buildQuery(filter);
        if (query) {
          queries.push(query);
        }
      }
    }

    // Add sorting
    if (config.sort) {
      const sortQuery =
        config.sort.direction === "desc"
          ? Query.orderDesc(config.sort.field)
          : Query.orderAsc(config.sort.field);
      queries.push(sortQuery);
    }

    // Add pagination
    if (typeof config.limit === "number") {
      queries.push(Query.limit(config.limit));
    }
    if (typeof config.offset === "number") {
      queries.push(Query.offset(config.offset));
    }

    // Include translation relations for content tables
    const contentTables = [
      "events",
      "news",
      "jobs",
      "products",
      "departments",
      "pages",
    ];
    if (contentTables.includes(config.table)) {
      queries.push(Query.select(["*", "translation_refs.*"]));
    }

    const response = await db.listRows({
      databaseId: DATABASE_ID,
      tableId: collectionId,
      queries,
    });

    const items = response.rows.map((row) => {
      const rowData = row as unknown as Record<string, unknown>;
      return normalizeItem(config.table, rowData, config.locale);
    });

    return {
      items,
      total: response.total,
      hasMore: response.total > (config.offset || 0) + items.length,
    };
  } catch (error) {
    console.error(
      `[fetchDynamicData] Failed to fetch from ${config.table}:`,
      error
    );
    return { items: [], total: 0, hasMore: false };
  }
}

/**
 * Get a single item by ID
 */
export async function fetchDynamicItem(
  table: string,
  id: string,
  locale?: string
): Promise<NormalizedItem | null> {
  if (!table) {
    return null;
  }
  if (!id) {
    return null;
  }

  try {
    const { db } = await createAdminClient();
    const collectionId = TABLE_COLLECTION_MAP[table] || table;

    const row = await db.getRow({
      databaseId: DATABASE_ID,
      tableId: collectionId,
      rowId: id,
    });
    const rowData = row as unknown as Record<string, unknown>;
    return normalizeItem(table, rowData, locale);
  } catch (error) {
    console.error(`[fetchDynamicItem] Failed to fetch ${table}/${id}:`, error);
    return null;
  }
}

/**
 * Count items matching criteria
 */
export async function countDynamicData(
  config: Omit<DataSourceConfig, "limit" | "offset" | "sort">
): Promise<number> {
  if (!config?.table) {
    return 0;
  }

  try {
    const { db } = await createAdminClient();
    const collectionId = TABLE_COLLECTION_MAP[config.table] || config.table;

    const queries: string[] = [Query.limit(1)];

    if (config.filters?.length) {
      for (const filter of config.filters) {
        const query = buildQuery(filter);
        if (query) {
          queries.push(query);
        }
      }
    }

    const response = await db.listRows({
      databaseId: DATABASE_ID,
      tableId: collectionId,
      queries,
    });

    return response.total;
  } catch (error) {
    console.error(`[countDynamicData] Failed to count ${config.table}:`, error);
    return 0;
  }
}
