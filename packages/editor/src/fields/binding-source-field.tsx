"use client";

import type { CustomField } from "@puckeditor/core";
import {
  DataSourcePicker,
  type DataSourceValue,
  type TableSchema,
} from "@repo/ui/components/data-source-picker";
import { TABLE_SCHEMAS } from "../data/schemas";

/**
 * Binding source types that define how a block prop gets its value.
 * - "static": Value is set directly in the editor (default behavior)
 * - "field": Value comes from a content entry field (defined in template field schema)
 * - "query": Value comes from a database query (events, news, jobs, etc.)
 * - "context": Value comes from page context (locale, path, etc.)
 */
export type BindingSourceType = "static" | "field" | "query" | "context";

export type BindingSourceValue = {
  sourceType: BindingSourceType;
  /** For "field": the field ID from the template's field schema */
  fieldId?: string;
  /** For "field": fallback value when field is empty */
  fallback?: unknown;
  /** For "query": database query configuration */
  query?: DataSourceValue;
  /** For "context": which context value to use */
  contextKey?:
    | "locale"
    | "path"
    | "entryId"
    | "kind"
    | "visibility"
    | "isAuthenticated"
    | "campusId"
    | "departmentId";
};

export type FieldSchemaEntry = {
  id: string;
  label: string;
  type: string;
};

type BindingSourceFieldProps = {
  label?: string;
  /** Available template fields for "field" binding */
  fieldSchema?: FieldSchemaEntry[];
  /** Available table schemas for "query" binding */
  schemas?: TableSchema[];
  /** Which source types to allow (defaults to all) */
  allowedSources?: BindingSourceType[];
  /** Whether to show the "static" option (defaults to true) */
  showStatic?: boolean;
};

const CONTEXT_OPTIONS = [
  { value: "locale", label: "Current language" },
  { value: "path", label: "Page URL path" },
  { value: "entryId", label: "Entry ID" },
  { value: "kind", label: "Content type (page/article/policy)" },
  { value: "visibility", label: "Page visibility" },
  { value: "isAuthenticated", label: "User is logged in" },
  { value: "campusId", label: "Campus" },
  { value: "departmentId", label: "Department" },
] as const;

const SOURCE_LABELS: Record<BindingSourceType, string> = {
  static: "Enter value manually",
  field: "Pull from content field",
  query: "Pull from database",
  context: "Pull from page context",
};

const SOURCE_DESCRIPTIONS: Record<BindingSourceType, string> = {
  static: "Set a fixed value directly",
  field: "Use a value that content editors fill in per page",
  query: "Fetch live data from your database",
  context: "Use page metadata like language or URL",
};

export function bindingSourceField({
  label = "Data Binding",
  fieldSchema = [],
  schemas,
  allowedSources = ["static", "field", "query", "context"],
  showStatic = true,
}: BindingSourceFieldProps = {}): CustomField<BindingSourceValue> {
  const availableSources = showStatic
    ? allowedSources
    : allowedSources.filter((s) => s !== "static");

  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => {
      const current: BindingSourceValue = value ?? { sourceType: "static" };

      return (
        <div
          aria-disabled={readOnly}
          className={`flex flex-col gap-3 ${readOnly ? "pointer-events-none opacity-60" : ""}`}
        >
          {/* Source type selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Data source
            </label>
            <div className="flex flex-col gap-1">
              {availableSources.map((sourceType) => (
                <button
                  key={sourceType}
                  type="button"
                  onClick={() => {
                    if (readOnly) return;
                    onChange({ ...current, sourceType });
                  }}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    current.sourceType === sourceType
                      ? "border-blue-500 bg-blue-50 text-blue-900"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="font-medium">
                    {SOURCE_LABELS[sourceType]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {SOURCE_DESCRIPTIONS[sourceType]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Field source config */}
          {current.sourceType === "field" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Content field
              </label>
              {fieldSchema.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                  No content fields defined yet. Add fields in the template
                  field schema to use this option.
                </p>
              ) : (
                <select
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={current.fieldId ?? ""}
                  onChange={(e) => {
                    if (readOnly) return;
                    onChange({ ...current, fieldId: e.target.value || undefined });
                  }}
                >
                  <option value="">Select a field...</option>
                  {fieldSchema.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label} ({field.type})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Query source config */}
          {current.sourceType === "query" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Database query
              </label>
              <DataSourcePicker
                onChange={(next) => {
                  if (readOnly) return;
                  onChange({ ...current, query: next });
                }}
                schemas={(schemas ?? TABLE_SCHEMAS) as never}
                value={(current.query ?? {}) as DataSourceValue}
              />
            </div>
          )}

          {/* Context source config */}
          {current.sourceType === "context" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Context value
              </label>
              <select
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                value={current.contextKey ?? ""}
                onChange={(e) => {
                  if (readOnly) return;
                  onChange({
                    ...current,
                    contextKey: (e.target.value || undefined) as BindingSourceValue["contextKey"],
                  });
                }}
              >
                <option value="">Select a value...</option>
                {CONTEXT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      );
    },
  };
}
