"use client";

import { useState, useEffect } from "react";
import type { Field } from "@measured/puck";
import { FieldLabel } from "@measured/puck";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Loader2 } from "lucide-react";

export type NumericFieldSelectorProps = {
  field: Field<string>;
  name: string;
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  collectionId?: string;
};

type ColumnInfo = {
  key: string;
  type: string;
  required: boolean;
  array?: boolean;
};

const NUMERIC_TYPES = ["integer", "float", "double", "bigint", "number"];

export function NumericFieldSelector({
  field,
  name,
  value,
  onChange,
  readOnly,
  collectionId,
}: NumericFieldSelectorProps) {
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
          // Filter to only numeric columns
          const numericCols = result.data.columns.filter((col: ColumnInfo) =>
            NUMERIC_TYPES.some(type => col.type.toLowerCase().includes(type.toLowerCase()))
          );
          setColumns(numericCols);
        }
      } catch (err) {
        console.error("Failed to fetch schema:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSchema();
  }, [collectionId]);

  if (!collectionId) {
    return (
      <FieldLabel label={field.label || "Field"}>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
          Select a collection first
        </div>
      </FieldLabel>
    );
  }

  return (
    <FieldLabel label={field.label || "Field"}>
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading numeric fields...
          </div>
        ) : (
          <Select value={value} onValueChange={onChange} disabled={readOnly}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a numeric field..." />
            </SelectTrigger>
            <SelectContent>
              {columns.length === 0 ? (
                <div className="p-2 text-center text-sm text-gray-500">
                  No numeric fields found
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
        )}

        {value && (
          <p className="text-xs text-gray-500">
            Selected: <span className="font-mono">{value}</span>
          </p>
        )}
      </div>
    </FieldLabel>
  );
}

// Field configuration for use in Puck config
export const numericFieldSelector = {
  type: "custom",
  render: NumericFieldSelector,
} as const;

