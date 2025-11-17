import type { QueryConfig } from "../types";

/**
 * Common query presets for quick configuration
 */

export const queryPresets = {
  /**
   * Get all active items
   */
  allActive: (): QueryConfig => ({
    conditions: [
      {
        field: "status",
        operator: "equal",
        value: "active",
      },
    ],
    logic: "and",
    sort: [
      {
        field: "$createdAt",
        direction: "desc",
      },
    ],
    limit: 10,
  }),

  /**
   * Get latest 5 items
   */
  latest5: (): QueryConfig => ({
    conditions: [],
    sort: [
      {
        field: "$createdAt",
        direction: "desc",
      },
    ],
    limit: 5,
  }),

  /**
   * Get latest 10 items
   */
  latest10: (): QueryConfig => ({
    conditions: [],
    sort: [
      {
        field: "$createdAt",
        direction: "desc",
      },
    ],
    limit: 10,
  }),

  /**
   * Get published items only
   */
  publishedOnly: (): QueryConfig => ({
    conditions: [
      {
        field: "published",
        operator: "equal",
        value: true,
      },
    ],
    sort: [
      {
        field: "$createdAt",
        direction: "desc",
      },
    ],
    limit: 10,
  }),

  /**
   * Get featured items
   */
  featuredOnly: (): QueryConfig => ({
    conditions: [
      {
        field: "featured",
        operator: "equal",
        value: true,
      },
    ],
    sort: [
      {
        field: "$createdAt",
        direction: "desc",
      },
    ],
    limit: 5,
  }),

  /**
   * Get items from last 30 days
   */
  last30Days: (): QueryConfig => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return {
      conditions: [
        {
          field: "$createdAt",
          operator: "greaterThan",
          value: thirtyDaysAgo.toISOString(),
        },
      ],
      sort: [
        {
          field: "$createdAt",
          direction: "desc",
        },
      ],
      limit: 10,
    };
  },

  /**
   * Get items sorted alphabetically
   */
  alphabetical: (): QueryConfig => ({
    conditions: [],
    sort: [
      {
        field: "name",
        direction: "asc",
      },
    ],
    limit: 20,
  }),

  /**
   * Get upcoming events (future dates)
   */
  upcomingEvents: (): QueryConfig => {
    const now = new Date().toISOString();

    return {
      conditions: [
        {
          field: "startDate",
          operator: "greaterThan",
          value: now,
        },
      ],
      sort: [
        {
          field: "startDate",
          direction: "asc",
        },
      ],
      limit: 10,
    };
  },

  /**
   * Get past events (historical dates)
   */
  pastEvents: (): QueryConfig => {
    const now = new Date().toISOString();

    return {
      conditions: [
        {
          field: "startDate",
          operator: "lessThan",
          value: now,
        },
      ],
      sort: [
        {
          field: "startDate",
          direction: "desc",
        },
      ],
      limit: 10,
    };
  },

  /**
   * Get items by campus/location
   */
  byCampus: (campusId: string): QueryConfig => ({
    conditions: [
      {
        field: "campus_id",
        operator: "equal",
        value: campusId,
      },
    ],
    sort: [
      {
        field: "name",
        direction: "asc",
      },
    ],
    limit: 20,
  }),

  /**
   * Get top rated items
   */
  topRated: (): QueryConfig => ({
    conditions: [
      {
        field: "rating",
        operator: "greaterThanEqual",
        value: 4,
      },
    ],
    sort: [
      {
        field: "rating",
        direction: "desc",
      },
    ],
    limit: 10,
  }),

  /**
   * Empty query (all items, default sort)
   */
  all: (): QueryConfig => ({
    conditions: [],
    sort: [],
    limit: 25,
  }),
};

/**
 * Get all available query presets
 */
export function getQueryPresets() {
  return Object.keys(queryPresets)
    .filter((key) => typeof (queryPresets as any)[key] === "function")
    .map((key) => ({
      id: key,
      name: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim(),
      requiresParams: key === "byCampus",
    }));
}

/**
 * Get a query preset by ID
 */
export function getQueryPreset(
  id: keyof typeof queryPresets,
  params?: any
): QueryConfig {
  const preset = (queryPresets as any)[id];
  if (!preset || typeof preset !== "function") {
    throw new Error(`Query preset "${id}" not found`);
  }
  return preset(params);
}

