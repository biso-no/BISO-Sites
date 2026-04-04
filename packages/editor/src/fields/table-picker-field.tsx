"use client";

import type { CustomField } from "@puckeditor/core";
import { TablePicker } from "@repo/ui/components/table-picker";
import { getTables } from "../get-tables";

export interface TablePickerValue {
  filters?: {
    field: string;
    operator: string;
    value: unknown;
  }[];
  limit?: number;
  operation?: "list" | "count" | "sum";
  table?: string;
}

export function tablePickerField({
  label = "Table",
}: {
  label?: string;
} = {}): CustomField<TablePickerValue> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => (
      <div aria-disabled={readOnly} className={readOnly ? "opacity-60" : ""}>
        <TablePicker
          getTables={getTables}
          onChange={(next) => {
            if (readOnly) {
              return;
            }
            onChange(next as TablePickerValue);
          }}
          value={(value ?? {}) as TablePickerValue}
        />
      </div>
    ),
  };
}
