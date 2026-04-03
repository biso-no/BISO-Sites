"use client";

import { TABLE_SCHEMAS } from "../../data/schemas";
import type { DataSourceValue } from "../types";

/**
 * The "data mode" radio field used on every dynamic list component.
 * Saves repeating the same two-option radio definition across all data blocks.
 */
export const DATA_MODE_FIELD = {
  type: "radio" as const,
  label: "Data Source",
  options: [
    { label: "Manual Entry", value: "manual" },
    { label: "Dynamic (Database)", value: "dynamic" },
  ],
};

/**
 * The "scope" radio field: this page vs all content.
 */
export const SCOPE_FIELD = {
  type: "radio" as const,
  label: "Scope",
  options: [
    { label: "This page", value: "page" },
    { label: "All content", value: "all" },
  ],
};

/**
 * Build the `external` field config for a given table schema.
 * Returns a Puck `external` field that lets editors pick a preset filter set
 * from the TABLE_SCHEMAS registry.
 *
 * @param tableId - Schema id from `data/schemas.ts` (e.g. "news", "events")
 * @param label   - Human-readable label shown in the Puck sidebar
 */
export function buildExternalDataSourceField(tableId: string, label: string) {
  return {
    type: "external" as const,
    label,
    cache: { enabled: true },
    fetchList: async () => {
      const schema = TABLE_SCHEMAS.find((s) => s.id === tableId);
      if (!schema) {
        return [];
      }
      return [
        {
          id: "default",
          title: `All ${schema.label}`,
          table: schema.id,
          filters: [],
          sort: schema.defaultSort,
        },
        ...(schema.presetFilters ?? []).map((p, i) => ({
          id: `preset-${i}`,
          title: p.label,
          table: schema.id,
          filters: p.filters,
          sort: schema.defaultSort,
        })),
      ];
    },
    filterFields: {
      limit: { type: "number" as const, label: "Limit" },
    },
    mapProp: (selected: Record<string, unknown>) =>
      ({
        table: selected?.table as string | undefined,
        filters: (selected?.filters as DataSourceValue["filters"]) ?? [],
        sort: selected?.sort as DataSourceValue["sort"],
        limit: (selected?.limit as number) ?? 6,
      }) satisfies DataSourceValue,
  };
}

/**
 * Standard shouldResolve guard for dynamic list components.
 *
 * Returns `true` when the component should fetch fresh data from the API:
 * - Never on `move` (drag/drop repositioning)
 * - Always on `insert`, `load`, or `force`
 * - On field changes for any of the provided keys
 */
export function shouldResolveDynamic(params: {
  trigger: string;
  changed: Record<string, boolean>;
  watchKeys: string[];
}): boolean {
  const { trigger, changed, watchKeys } = params;

  if (trigger === "move") {
    return false;
  }

  if (trigger === "insert" || trigger === "load" || trigger === "force") {
    return true;
  }

  return watchKeys.some((key) => Boolean(changed[key]));
}
