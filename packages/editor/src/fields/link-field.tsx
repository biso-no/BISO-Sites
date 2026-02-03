"use client";

import type { CustomField } from "@puckeditor/core";
import { LinkPicker } from "@repo/ui/components/link-picker";
import { getPages } from "../get-pages";

export function linkField({
  label = "Link",
}: {
  label?: string;
} = {}): CustomField<string> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => (
      <div aria-disabled={readOnly} className={readOnly ? "opacity-60" : ""}>
        <LinkPicker
          getPages={getPages}
          onChange={(next) => {
            if (readOnly) {
              return;
            }
            onChange(next);
          }}
          value={typeof value === "string" ? value : ""}
        />
      </div>
    ),
  };
}

