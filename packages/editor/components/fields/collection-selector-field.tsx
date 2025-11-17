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
import { Database, Loader2 } from "lucide-react";

export type CollectionSelectorFieldProps = {
  field: Field<string>;
  name: string;
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

type Collection = {
  $id: string;
  name: string;
  $permissions?: string[];
};

export function CollectionSelectorField({
  field,
  name,
  value,
  onChange,
  readOnly,
}: CollectionSelectorFieldProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCollections() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/admin/collections");
        if (!response.ok) {
          throw new Error("Failed to fetch collections");
        }

        const result = await response.json();
        if (result.success) {
          setCollections(result.data || []);
        } else {
          setError(result.error || "Failed to load collections");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load collections");
      } finally {
        setLoading(false);
      }
    }

    fetchCollections();
  }, []);

  return (
    <FieldLabel label={field.label || "Collection"}>
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading collections...
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <Select value={value} onValueChange={onChange} disabled={readOnly}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a collection..." />
            </SelectTrigger>
            <SelectContent>
              {collections.length === 0 ? (
                <div className="p-2 text-center text-sm text-gray-500">
                  No collections found
                </div>
              ) : (
                collections.map((collection) => (
                  <SelectItem key={collection.$id} value={collection.$id}>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-gray-400" />
                      <span>{collection.name}</span>
                      <span className="text-xs text-gray-400">
                        ({collection.$id})
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}

        {value && !loading && (
          <p className="text-xs text-gray-500">
            Selected: <span className="font-mono">{value}</span>
          </p>
        )}
      </div>
    </FieldLabel>
  );
}

// Field configuration for use in Puck config
export const collectionSelectorField = {
  type: "custom",
  render: CollectionSelectorField,
} as const;

