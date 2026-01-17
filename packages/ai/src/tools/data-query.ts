import { z } from "zod";

/**
 * Query parameters for searching entities
 */
export const querySchema = z.object({
  entityType: z
    .enum(["events", "jobs", "pages", "products", "posts", "users"])
    .describe("The type of entity to search"),
  filters: z
    .object({
      status: z
        .string()
        .optional()
        .describe("Filter by status (draft, published, etc.)"),
      search: z.string().optional().describe("Search term for title/name"),
      locale: z.string().optional().describe("Filter by locale (en, no)"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of results (default 10)"),
      sortBy: z.string().optional().describe("Field to sort by"),
      sortOrder: z.enum(["asc", "desc"]).optional().describe("Sort order"),
    })
    .optional()
    .describe("Optional filters for the query"),
});

export type QueryParams = z.infer<typeof querySchema>;

/**
 * Result type for query operations
 */
export type QueryResult = {
  success: boolean;
  entityType: string;
  count: number;
  items: Array<{
    id: string;
    title: string;
    status?: string;
    locale?: string;
    createdAt?: string;
    summary?: string;
  }>;
  message?: string;
};

/**
 * Query handler type - implement this in your app to connect to your database
 */
export type QueryHandler = (params: QueryParams) => Promise<QueryResult>;

/**
 * Tool description for data query
 */
export const dataQueryToolDescription = `Search and list entities from the database. Use this to:
- Find specific events, jobs, pages, products, or posts
- List recent items of a type
- Search by title or status
- Get counts of items

Examples:
- "Show me all published events" → query events with status=published
- "Find pages about careers" → query pages with search="careers"
- "List recent job postings" → query jobs with limit=5, sortBy=createdAt

IMPORTANT: This tool only READS data. It cannot create, update, or delete anything.`;

/**
 * Create a data query tool execute function
 * @param queryHandler - Function that executes the actual database query
 */
export function createDataQueryExecute(queryHandler: QueryHandler) {
  return async (params: QueryParams): Promise<QueryResult> => {
    try {
      const result = await queryHandler(params);
      return result;
    } catch (error) {
      return {
        success: false,
        entityType: params.entityType,
        count: 0,
        items: [],
        message: `Failed to query ${params.entityType}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  };
}

/**
 * Get entity by ID parameters
 */
export const getEntitySchema = z.object({
  entityType: z
    .enum(["event", "job", "page", "product", "post", "user"])
    .describe("The type of entity to fetch"),
  id: z.string().describe("The ID of the entity to fetch"),
  locale: z.string().optional().describe("Preferred locale for translations"),
});

export type GetEntityParams = z.infer<typeof getEntitySchema>;

/**
 * Result type for get entity operations
 */
export type GetEntityResult = {
  success: boolean;
  entityType: string;
  entity: Record<string, unknown> | null;
  message?: string;
};

/**
 * Get entity handler type
 */
export type GetEntityHandler = (
  params: GetEntityParams
) => Promise<GetEntityResult>;

/**
 * Tool description for get entity
 */
export const getEntityToolDescription = `Fetch a specific entity by its ID. Use this to:
- Get full details of an event, job, page, product, or post
- Read the current state of an entity before modifying it
- Verify an entity exists

IMPORTANT: This tool only READS data. It cannot create, update, or delete anything.`;

/**
 * Create a get entity execute function
 * @param getHandler - Function that fetches the entity from your database
 */
export function createGetEntityExecute(getHandler: GetEntityHandler) {
  return async (params: GetEntityParams): Promise<GetEntityResult> => {
    try {
      const result = await getHandler(params);
      return result;
    } catch (error) {
      return {
        success: false,
        entityType: params.entityType,
        entity: null,
        message: `Failed to fetch ${params.entityType}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  };
}

/**
 * Dashboard stats parameters
 */
export const dashboardStatsSchema = z.object({
  includeRecent: z
    .boolean()
    .optional()
    .describe("Include recent items from each category"),
});

export type DashboardStatsParams = z.infer<typeof dashboardStatsSchema>;

/**
 * Dashboard stats result
 */
export type DashboardStatsResult = {
  success: boolean;
  stats: {
    events: { total: number; published: number; draft: number };
    jobs: { total: number; active: number; closed: number };
    pages: { total: number; published: number; draft: number };
    products: { total: number; inStock: number; outOfStock: number };
    posts: { total: number; published: number; draft: number };
  };
  recent?: {
    events: Array<{ id: string; title: string; date?: string }>;
    jobs: Array<{ id: string; title: string; deadline?: string }>;
    pages: Array<{ id: string; title: string }>;
  };
  message?: string;
};

/**
 * Dashboard stats handler type
 */
export type DashboardStatsHandler = (
  params: DashboardStatsParams
) => Promise<DashboardStatsResult>;

/**
 * Tool description for dashboard stats
 */
export const dashboardStatsToolDescription = `Get dashboard statistics and overview. Use this to:
- Understand the current state of the admin dashboard
- Get counts of events, jobs, pages, products, posts
- See recent activity
- Answer questions like "How many events do we have?" or "What's the latest job posting?"`;

/**
 * Create a dashboard stats execute function
 * @param statsHandler - Function that fetches dashboard statistics
 */
export function createDashboardStatsExecute(
  statsHandler: DashboardStatsHandler
) {
  return async (
    params: DashboardStatsParams
  ): Promise<DashboardStatsResult> => {
    try {
      const result = await statsHandler(params);
      return result;
    } catch (error) {
      return {
        success: false,
        stats: {
          events: { total: 0, published: 0, draft: 0 },
          jobs: { total: 0, active: 0, closed: 0 },
          pages: { total: 0, published: 0, draft: 0 },
          products: { total: 0, inStock: 0, outOfStock: 0 },
          posts: { total: 0, published: 0, draft: 0 },
        },
        message: `Failed to fetch dashboard stats: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  };
}
