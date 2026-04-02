"use client";

import type { CustomField } from "@puckeditor/core";
import { DateTimePicker } from "@repo/ui/components/date-time-picker";

export function dateTimeField({
  label = "Schedule Publish",
}: {
  label?: string;
} = {}): CustomField<string | null> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => (
      <DateTimePicker
        label={label}
        onChange={(next) => {
          if (readOnly) return;
          onChange(next);
        }}
        readOnly={readOnly}
        value={typeof value === "string" ? value : null}
      />
    ),
  };
}
