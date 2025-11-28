"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";

export type TablePickerProps = {
  value: {
    table?: string;
    filters?: {
      field: string;
      operator: string;
      value: any;
    }[];
    operation?: "list" | "count" | "sum";
    limit?: number;
  };
  onChange: (value: any) => void;
  getTables: () => Promise<{ label: string; value: string }[]>;
};

const FILTER_PRESETS: Record<string, { label: string; field: string; operator: string; value: any }[]> = {
  events: [
    { label: "Featured Only", field: "featured", operator: "equal", value: true },
    { label: "Upcoming", field: "date", operator: "greater", value: "now" },
  ],
  news: [
    { label: "Featured Only", field: "featured", operator: "equal", value: true },
  ],
  jobs: [
    { label: "Featured Only", field: "featured", operator: "equal", value: true },
    { label: "Full Time", field: "type", operator: "equal", value: "full_time" },
  ],
};

export function TablePicker({ value = {}, onChange, getTables }: TablePickerProps) {
  const [tables, setTables] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadTables = async () => {
      setLoading(true);
      try {
        const fetchedTables = await getTables();
        setTables(fetchedTables);
      } catch (error) {
        console.error("Failed to load tables", error);
      } finally {
        setLoading(false);
      }
    };

    loadTables();
  }, [getTables]);

  const handleTableChange = (table: string) => {
    onChange({ ...value, table, filters: [] });
  };

  const toggleFilter = (filterPreset: any) => {
    const currentFilters = value.filters || [];
    const exists = currentFilters.find(
      (f: any) => f.field === filterPreset.field && f.operator === filterPreset.operator
    );

    let newFilters;
    if (exists) {
      newFilters = currentFilters.filter(
        (f: any) => !(f.field === filterPreset.field && f.operator === filterPreset.operator)
      );
    } else {
      newFilters = [...currentFilters, { field: filterPreset.field, operator: filterPreset.operator, value: filterPreset.value }];
    }
    onChange({ ...value, filters: newFilters });
  };

  const currentPresets = value.table ? FILTER_PRESETS[value.table] || [] : [];

  return (
    <div className="grid gap-4 border p-3 rounded-md">
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Source Table</Label>
        <Select
          value={value.table || ""}
          onValueChange={handleTableChange}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading..." : "Select a table"} />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table.value} value={table.value}>
                {table.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.table && (
        <>
           <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">Operation</Label>
            <Select
              value={value.operation || "list"}
              onValueChange={(op) => onChange({ ...value, operation: op })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">List Items</SelectItem>
                <SelectItem value="count">Count Items</SelectItem>
                <SelectItem value="sum">Sum Value</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {currentPresets.length > 0 && (
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">Filters</Label>
              <div className="grid gap-2">
                {currentPresets.map((preset, i) => {
                  const isChecked = (value.filters || []).some(
                    (f: any) => f.field === preset.field && f.operator === preset.operator
                  );
                  return (
                    <div key={i} className="flex items-center space-x-2">
                      <Checkbox
                        id={`filter-${i}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleFilter(preset)}
                      />
                      <label
                        htmlFor={`filter-${i}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {preset.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
