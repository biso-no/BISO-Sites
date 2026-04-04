/**
 * Data Source Configuration Types
 * Used by Puck blocks to configure dynamic data fetching
 */

/** Supported database tables for dynamic content */
export type DataTable =
  | "events"
  | "news"
  | "jobs"
  | "partners"
  | "departments"
  | "team"
  | "products"
  | "memberships"
  | "pages"
  | "milestones";

/** Filter operators for querying data */
export type FilterOperator =
  | "equal"
  | "notEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "isNull"
  | "isNotNull";

/** Single filter condition */
export interface DataFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/** Sort direction */
export type SortDirection = "asc" | "desc";

/** Sort configuration */
export interface DataSort {
  direction: SortDirection;
  field: string;
}

/** Field mapping for transforming data to component props */
export interface FieldMapping {
  fallback?: unknown;
  source: string;
  target: string;
  transform?: "none" | "date" | "currency" | "image" | "truncate";
}

/**
 * Complete data source configuration
 * This is what gets stored in Puck component props
 */
export interface DataSourceConfig {
  /** Filters to apply */
  filters?: DataFilter[];
  /** Whether to include related data */
  includeRelations?: boolean;
  /** Maximum items to fetch */
  limit?: number;
  /** Locale for content translations */
  locale?: string;
  /** Field mappings for transforming data */
  mappings?: FieldMapping[];
  /** Offset for pagination */
  offset?: number;
  /** Sort configuration */
  sort?: DataSort;
  /** The database table to query */
  table: DataTable | string;
}

/**
 * Normalized item from any data source
 * Common shape that all fetched items get transformed to
 */
export interface NormalizedItem {
  badge?: string;
  category?: string;
  date?: string;
  description?: string;
  endDate?: string;
  href?: string;
  id: string;
  image?: string;
  location?: string;
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
  subtitle?: string;
  title: string;
}

/** Result from data fetching */
export interface DataFetchResult {
  hasMore: boolean;
  items: NormalizedItem[];
  total: number;
}

/** Table schema information for the picker UI */
export interface TableSchema {
  defaultSort?: DataSort;
  description?: string;
  fields: {
    name: string;
    type: "string" | "number" | "boolean" | "date" | "array" | "object";
    label: string;
  }[];
  id: DataTable | string;
  label: string;
  presetFilters?: {
    label: string;
    filters: DataFilter[];
  }[];
}
