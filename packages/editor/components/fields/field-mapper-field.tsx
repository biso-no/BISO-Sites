"use client";

import { useState, useEffect } from "react";
import type { Field } from "@measured/puck";
import { FieldLabel } from "@measured/puck";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Loader2, ArrowRight } from "lucide-react";

export type FieldMapperFieldProps = {
  field: Field<Record<string, string>>;
  name: string;
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  readOnly?: boolean;
  collectionId?: string;
  targetFields?: { key: string; label: string; required?: boolean }[]; // Component fields to map to
};

type CollectionAttribute = {
  key: string;
  type: string;
  required: boolean;
  array?: boolean;
};

export function FieldMapperField({
  field,
  name,
  value = {},
  onChange,
  readOnly,
  collectionId,
  targetFields = [],
}: FieldMapperFieldProps) {
  const [dbFields, setDbFields] = useState<CollectionAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!collectionId) {
      setDbFields([]);
      return;
    }

    async function fetchSchema() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/admin/collections/${collectionId}/schema`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch collection schema");
        }

        const result = await response.json();
        if (result.success) {
          setDbFields(result.data.attributes || []);
        } else {
          setError(result.error || "Failed to load schema");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load schema"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSchema();
  }, [collectionId]);

  const updateMapping = (componentField: string, dbField: string) => {
    onChange({
      ...value,
      [componentField]: dbField,
    });
  };

  if (!collectionId) {
    return (
      <FieldLabel label={field.label || "Field Mapping"}>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          Select a collection first to configure field mapping
        </div>
      </FieldLabel>
    );
  }

  return (
    <FieldLabel label={field.label || "Field Mapping"}>
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading collection schema...
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-600">
              Map database fields to component properties
            </p>

            {targetFields.length === 0 ? (
              <div className="text-sm text-gray-500">
                No mappable fields defined for this component
              </div>
            ) : (
              <div className="space-y-3">
                {targetFields.map((targetField) => (
                  <div
                    key={targetField.key}
                    className="flex items-center gap-3 rounded-md border border-gray-200 bg-white p-3"
                  >
                    <div className="flex-1">
                      <Label className="text-xs font-medium">
                        {targetField.label}
                        {targetField.required && (
                          <span className="ml-1 text-red-500">*</span>
                        )}
                      </Label>
                      <div className="mt-1 text-xs text-gray-500">
                        Component field
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-gray-400" />

                    <div className="flex-1">
                      <Select
                        value={value[targetField.key] || ""}
                        onValueChange={(val) =>
                          updateMapping(targetField.key, val)
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select DB field..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">
                            <span className="text-gray-400">None</span>
                          </SelectItem>
                          {dbFields.map((attr) => (
                            <SelectItem key={attr.key} value={attr.key}>
                              <div className="flex items-center gap-2">
                                <span>{attr.key}</span>
                                <span className="text-xs text-gray-400">
                                  ({attr.type}
                                  {attr.array ? "[]" : ""})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Show unmapped database fields */}
            {dbFields.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                  Available database fields ({dbFields.length})
                </summary>
                <div className="mt-2 space-y-1 rounded-md bg-white p-2">
                  {dbFields.map((attr) => (
                    <div
                      key={attr.key}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-mono">{attr.key}</span>
                      <span className="text-gray-500">
                        {attr.type}
                        {attr.array ? "[]" : ""}
                        {attr.required && (
                          <span className="ml-1 text-red-500">*</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </FieldLabel>
  );
}

// Field configuration for use in Puck config
export const fieldMapperField = {
  type: "custom",
  render: FieldMapperField,
} as const;

