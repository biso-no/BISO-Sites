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
  | "pages";

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
export type DataFilter = {
  field: string;
  operator: FilterOperator;
  value: unknown;
};

/** Sort direction */
export type SortDirection = "asc" | "desc";

/** Sort configuration */
export type DataSort = {
  field: string;
  direction: SortDirection;
};

/** Field mapping for transforming data to component props */
export type FieldMapping = {
  source: string;
  target: string;
  transform?: "none" | "date" | "currency" | "image" | "truncate";
  fallback?: unknown;
};

/**
 * Complete data source configuration
 * This is what gets stored in Puck component props
 */
export type DataSourceConfig = {
  /** The database table to query */
  table: DataTable | string;
  /** Filters to apply */
  filters?: DataFilter[];
  /** Sort configuration */
  sort?: DataSort;
  /** Maximum items to fetch */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Field mappings for transforming data */
  mappings?: FieldMapping[];
  /** Whether to include related data */
  includeRelations?: boolean;
  /** Locale for content translations */
  locale?: string;
};

/**
 * Normalized item from any data source
 * Common shape that all fetched items get transformed to
 */
export type NormalizedItem = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  href?: string;
  date?: string;
  endDate?: string;
  location?: string;
  category?: string;
  badge?: string;
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

/** Result from data fetching */
export type DataFetchResult = {
  items: NormalizedItem[];
  total: number;
  hasMore: boolean;
};

/** Table schema information for the picker UI */
export type TableSchema = {
  id: DataTable | string;
  label: string;
  description?: string;
  fields: {
    name: string;
    type: "string" | "number" | "boolean" | "date" | "array" | "object";
    label: string;
  }[];
  defaultSort?: DataSort;
  presetFilters?: {
    label: string;
    filters: DataFilter[];
  }[];
};
