"use client";

import { useState, useEffect } from "react";
import type { Field } from "@measured/puck";
import { FieldLabel } from "@measured/puck";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Plus, Trash2, ArrowUpDown, Loader2 } from "lucide-react";
import type { QueryConfig, QueryCondition, QueryOperator, QuerySort } from "../../types";

export type SchemaAwareQueryBuilderFieldProps = {
  field: Field<QueryConfig>;
  name: string;
  value?: QueryConfig;
  onChange: (value: QueryConfig) => void;
  readOnly?: boolean;
  collectionId?: string; // Pass the selected collection ID
};

const OPERATORS: { value: QueryOperator; label: string; needsValue: boolean }[] = [
  { value: "equal", label: "Equals", needsValue: true },
  { value: "notEqual", label: "Not Equals", needsValue: true },
  { value: "lessThan", label: "Less Than", needsValue: true },
  { value: "lessThanEqual", label: "Less Than or Equal", needsValue: true },
  { value: "greaterThan", label: "Greater Than", needsValue: true },
  { value: "greaterThanEqual", label: "Greater Than or Equal", needsValue: true },
  { value: "contains", label: "Contains", needsValue: true },
  { value: "search", label: "Search", needsValue: true },
  { value: "startsWith", label: "Starts With", needsValue: true },
  { value: "endsWith", label: "Ends With", needsValue: true },
  { value: "isNull", label: "Is Null", needsValue: false },
  { value: "isNotNull", label: "Is Not Null", needsValue: false },
  { value: "between", label: "Between", needsValue: true },
];

type ColumnInfo = {
  key: string;
  type: string;
  required: boolean;
  array?: boolean;
};

export function SchemaAwareQueryBuilderField({
  field,
  name,
  value = { conditions: [], limit: 10 },
  onChange,
  readOnly,
  collectionId,
}: SchemaAwareQueryBuilderFieldProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!collectionId) {
      setColumns([]);
      return;
    }

    async function fetchSchema() {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/collections/${collectionId}/schema`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch schema");
        }

        const result = await response.json();
        if (result.success && result.data.columns) {
          setColumns(result.data.columns);
        }
      } catch (err) {
        console.error("Failed to fetch schema:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSchema();
  }, [collectionId]);

  const addCondition = () => {
    onChange({
      ...value,
      conditions: [
        ...value.conditions,
        { field: "", operator: "equal", value: "" },
      ],
    });
  };

  const updateCondition = (index: number, updates: Partial<QueryCondition>) => {
    const newConditions = [...value.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    onChange({ ...value, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    onChange({
      ...value,
      conditions: value.conditions.filter((_, i) => i !== index),
    });
  };

  const addSort = () => {
    onChange({
      ...value,
      sort: [...(value.sort || []), { field: "", direction: "asc" }],
    });
  };

  const updateSort = (index: number, updates: Partial<QuerySort>) => {
    const newSort = [...(value.sort || [])];
    newSort[index] = { ...newSort[index], ...updates };
    onChange({ ...value, sort: newSort });
  };

  const removeSort = (index: number) => {
    onChange({
      ...value,
      sort: value.sort?.filter((_, i) => i !== index),
    });
  };

  if (!collectionId) {
    return (
      <FieldLabel label={field.label || "Query Configuration"}>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          Select a collection first to build queries
        </div>
      </FieldLabel>
    );
  }

  return (
    <FieldLabel label={field.label || "Query Configuration"}>
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading schema...
          </div>
        )}

        {/* Conditions */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium">Filters</h4>
            {value.conditions.length > 1 && (
              <Select
                value={value.logic || "and"}
                onValueChange={(val: "and" | "or") =>
                  onChange({ ...value, logic: val })
                }
                disabled={readOnly}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="and">AND</SelectItem>
                  <SelectItem value="or">OR</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            {value.conditions.map((condition, index) => {
              const selectedOperator = OPERATORS.find(op => op.value === condition.operator);
              
              return (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-md border border-gray-200 bg-white p-3"
                >
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    {/* Field name - Dropdown */}
                    <Select
                      value={condition.field}
                      onValueChange={(val) => updateCondition(index, { field: val })}
                      disabled={readOnly || loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.length === 0 ? (
                          <div className="p-2 text-center text-sm text-gray-500">
                            No fields available
                          </div>
                        ) : (
                          columns.map((col) => (
                            <SelectItem key={col.key} value={col.key}>
                              <div className="flex items-center gap-2">
                                <span>{col.key}</span>
                                <span className="text-xs text-gray-400">
                                  ({col.type})
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {/* Operator */}
                    <Select
                      value={condition.operator}
                      onValueChange={(val: QueryOperator) =>
                        updateCondition(index, { operator: val })
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Value (hidden for isNull/isNotNull) */}
                    {selectedOperator?.needsValue && (
                      <Input
                        placeholder="Value"
                        value={condition.value?.toString() || ""}
                        onChange={(e) =>
                          updateCondition(index, { value: e.target.value })
                        }
                        disabled={readOnly}
                      />
                    )}
                  </div>

                  {!readOnly && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}

            {!readOnly && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addCondition}
                className="w-full"
                disabled={loading}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Condition
              </Button>
            )}
          </div>
        </div>

        {/* Basic options */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Limit
            </label>
            <Input
              type="number"
              min={0}
              max={5000}
              value={value.limit || 10}
              onChange={(e) =>
                onChange({ ...value, limit: parseInt(e.target.value) || 10 })
              }
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Offset
            </label>
            <Input
              type="number"
              min={0}
              value={value.offset || 0}
              onChange={(e) =>
                onChange({ ...value, offset: parseInt(e.target.value) || 0 })
              }
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Advanced: Sorting */}
        {showAdvanced && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Sorting</h4>
            <div className="space-y-2">
              {(value.sort || []).map((sort, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-md border border-gray-200 bg-white p-3"
                >
                  <Select
                    value={sort.field}
                    onValueChange={(val) => updateSort(index, { field: val })}
                    disabled={readOnly || loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          {col.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={sort.direction}
                    onValueChange={(val: "asc" | "desc") =>
                      updateSort(index, { direction: val })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>

                  {!readOnly && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSort(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addSort}
                  className="w-full"
                  disabled={loading}
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Add Sort Field
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Toggle advanced */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full"
        >
          {showAdvanced ? "Hide" : "Show"} Advanced Options
        </Button>
      </div>
    </FieldLabel>
  );
}

// Field configuration for use in Puck config
export const schemaAwareQueryBuilderField = {
  type: "custom",
  render: SchemaAwareQueryBuilderField,
} as const;

