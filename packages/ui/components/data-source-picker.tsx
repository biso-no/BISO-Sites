"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { ChevronDown, ChevronUp, Database, Filter, SortAsc } from "lucide-react";
import { Button } from "./ui/button";

export type DataSourceValue = {
  table?: string;
  filters?: {
    field: string;
    operator: string;
    value: unknown;
  }[];
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
  limit?: number;
  locale?: string;
};

export type PresetFilter = {
  label: string;
  filters: { field: string; operator: string; value: unknown }[];
};

export type TableSchema = {
  id: string;
  label: string;
  description?: string;
  fields: {
    name: string;
    type: string;
    label: string;
  }[];
  defaultSort?: { field: string; direction: "asc" | "desc" };
  presetFilters?: PresetFilter[];
};

export type DataSourcePickerProps = {
  value: DataSourceValue;
  onChange: (value: DataSourceValue) => void;
  schemas: TableSchema[];
  showLimit?: boolean;
  showSort?: boolean;
  maxLimit?: number;
};

export function DataSourcePicker({
  value = {},
  onChange,
  schemas,
  showLimit = true,
  showSort = true,
  maxLimit = 100,
}: DataSourcePickerProps) {
  const [expanded, setExpanded] = useState(false);

  const currentSchema = schemas.find((s) => s.id === value.table);
  const presets = currentSchema?.presetFilters ?? [];

  const handleTableChange = (table: string) => {
    const schema = schemas.find((s) => s.id === table);
    onChange({
      table,
      filters: [],
      sort: schema?.defaultSort,
      limit: value.limit,
    });
  };

  const togglePresetFilter = (preset: PresetFilter) => {
    const currentFilters = value.filters ?? [];
    const presetKey = JSON.stringify(preset.filters);

    // Check if all filters in preset are already applied
    const isApplied = preset.filters.every((pf) =>
      currentFilters.some(
        (cf) =>
          cf.field === pf.field &&
          cf.operator === pf.operator &&
          cf.value === pf.value
      )
    );

    let newFilters: DataSourceValue["filters"];
    if (isApplied) {
      // Remove preset filters
      newFilters = currentFilters.filter(
        (cf) =>
          !preset.filters.some(
            (pf) =>
              cf.field === pf.field &&
              cf.operator === pf.operator &&
              cf.value === pf.value
          )
      );
    } else {
      // Add preset filters (avoiding duplicates)
      const filtersToAdd = preset.filters.filter(
        (pf) =>
          !currentFilters.some(
            (cf) =>
              cf.field === pf.field &&
              cf.operator === pf.operator
          )
      );
      newFilters = [...currentFilters, ...filtersToAdd];
    }

    onChange({ ...value, filters: newFilters });
  };

  const isPresetApplied = (preset: PresetFilter): boolean => {
    const currentFilters = value.filters ?? [];
    return preset.filters.every((pf) =>
      currentFilters.some(
        (cf) =>
          cf.field === pf.field &&
          cf.operator === pf.operator &&
          cf.value === pf.value
      )
    );
  };

  const handleSortChange = (field: string) => {
    const currentDirection = value.sort?.field === field ? value.sort.direction : undefined;
    const newDirection = currentDirection === "asc" ? "desc" : "asc";
    onChange({ ...value, sort: { field, direction: newDirection } });
  };

  const handleLimitChange = (limitStr: string) => {
    const limit = Number.parseInt(limitStr, 10);
    if (!Number.isNaN(limit) && limit > 0 && limit <= maxLimit) {
      onChange({ ...value, limit });
    }
  };

  return (
    <div className="grid gap-3 rounded-md border bg-card p-3">
      {/* Table selector */}
      <div className="grid gap-1.5">
        <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Database className="h-3 w-3" />
          Data Source
        </Label>
        <Select value={value.table ?? ""} onValueChange={handleTableChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select data source..." />
          </SelectTrigger>
          <SelectContent>
            {schemas.map((schema) => (
              <SelectItem key={schema.id} value={schema.id}>
                <div className="flex flex-col items-start">
                  <span>{schema.label}</span>
                  {schema.description && (
                    <span className="text-muted-foreground text-xs">
                      {schema.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.table && (
        <>
          {/* Quick filters (presets) */}
          {presets.length > 0 && (
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Filter className="h-3 w-3" />
                Quick Filters
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => {
                  const applied = isPresetApplied(preset);
                  return (
                    <Badge
                      key={`preset-${preset.label}`}
                      variant={applied ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => togglePresetFilter(preset)}
                    >
                      {preset.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Limit */}
          {showLimit && (
            <div className="grid gap-1.5">
              <Label className="text-muted-foreground text-xs">
                Max Items
              </Label>
              <Input
                type="number"
                min={1}
                max={maxLimit}
                value={value.limit ?? ""}
                onChange={(e) => handleLimitChange(e.target.value)}
                placeholder="No limit"
                className="h-8"
              />
            </div>
          )}

          {/* Advanced options toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="text-xs">Advanced Options</span>
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>

          {/* Advanced: Sort */}
          {expanded && showSort && currentSchema && (
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <SortAsc className="h-3 w-3" />
                Sort By
              </Label>
              <Select
                value={value.sort?.field ?? ""}
                onValueChange={handleSortChange}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Default sort" />
                </SelectTrigger>
                <SelectContent>
                  {currentSchema.fields.map((field) => (
                    <SelectItem key={field.name} value={field.name}>
                      {field.label}
                      {value.sort?.field === field.name && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({value.sort.direction})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Active filters summary */}
          {(value.filters?.length ?? 0) > 0 && (
            <div className="bg-muted/50 p-2 rounded text-xs">
              <span className="font-medium">
                {value.filters?.length} filter(s) active
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
