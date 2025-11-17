"use client";

import { useState } from "react";
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
import { Plus, Trash2, ArrowUpDown } from "lucide-react";
import type { QueryConfig, QueryCondition, QueryOperator, QuerySort } from "../../types";

export type QueryBuilderFieldProps = {
  field: Field<QueryConfig>;
  name: string;
  value?: QueryConfig;
  onChange: (value: QueryConfig) => void;
  readOnly?: boolean;
  collectionId?: string; // Optional: for field suggestions
};

const OPERATORS: { value: QueryOperator; label: string }[] = [
  { value: "equal", label: "Equals" },
  { value: "notEqual", label: "Not Equals" },
  { value: "lessThan", label: "Less Than" },
  { value: "lessThanEqual", label: "Less Than or Equal" },
  { value: "greaterThan", label: "Greater Than" },
  { value: "greaterThanEqual", label: "Greater Than or Equal" },
  { value: "contains", label: "Contains" },
  { value: "search", label: "Search" },
  { value: "startsWith", label: "Starts With" },
  { value: "endsWith", label: "Ends With" },
  { value: "isNull", label: "Is Null" },
  { value: "isNotNull", label: "Is Not Null" },
  { value: "between", label: "Between" },
];

export function QueryBuilderField({
  field,
  name,
  value = { conditions: [], limit: 10 },
  onChange,
  readOnly,
}: QueryBuilderFieldProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  return (
    <FieldLabel label={field.label || "Query Configuration"}>
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
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
            {value.conditions.map((condition, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-md border border-gray-200 bg-white p-3"
              >
                <div className="grid flex-1 gap-2 sm:grid-cols-3">
                  {/* Field name */}
                  <Input
                    placeholder="Field name"
                    value={condition.field}
                    onChange={(e) =>
                      updateCondition(index, { field: e.target.value })
                    }
                    disabled={readOnly}
                  />

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
                  {condition.operator !== "isNull" &&
                    condition.operator !== "isNotNull" && (
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
            ))}

            {!readOnly && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addCondition}
                className="w-full"
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
                  <Input
                    placeholder="Field name"
                    value={sort.field}
                    onChange={(e) =>
                      updateSort(index, { field: e.target.value })
                    }
                    disabled={readOnly}
                  />

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
export const queryBuilderField = {
  type: "custom",
  render: QueryBuilderField,
} as const;

