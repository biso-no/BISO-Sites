"use client";

import type { CustomField } from "@puckeditor/core";
import {
  DataSourcePicker,
  type DataSourceValue,
  type TableSchema,
} from "@repo/ui/components/data-source-picker";

export function dataSourceField({
  label = "Data Source",
  schemas,
}: {
  label?: string;
  schemas: TableSchema[];
}): CustomField<DataSourceValue> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => (
      <div aria-disabled={readOnly} className={readOnly ? "opacity-60" : ""}>
        <DataSourcePicker
          onChange={(next) => {
            if (readOnly) {
              return;
            }
            onChange(next);
          }}
          schemas={schemas}
          value={(value ?? {}) as DataSourceValue}
        />
      </div>
    ),
  };
}

