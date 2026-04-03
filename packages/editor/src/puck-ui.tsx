"use client";

import type { Config, Overrides } from "@puckeditor/core";
import { DateTimePicker } from "@repo/ui/components/date-time-picker";
import { FileUpload } from "@repo/ui/components/file-upload";
import { LinkPicker } from "@repo/ui/components/link-picker";
import { TablePicker } from "@repo/ui/components/table-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Laptop, Monitor, Smartphone, Tablet } from "lucide-react";
import type { ReactNode } from "react";
import { getPages } from "./get-pages";
import { getTables } from "./get-tables";
import { listImages, uploadImage } from "./upload-image";

type PuckFieldProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  name?: string;
  field?: unknown;
};

function ReadOnlyWrapper({
  children,
  readOnly,
}: {
  children: ReactNode;
  readOnly?: boolean;
}) {
  return (
    <div aria-disabled={readOnly} className={readOnly ? "opacity-60" : ""}>
      {children}
    </div>
  );
}

export const puckFieldOverrides: Partial<Overrides<Config>> = {
  fieldTypes: {
    // Wrap all custom fields in consistent styling
    custom: ({
      children,
      readOnly,
    }: {
      children: ReactNode;
      readOnly?: boolean;
    }) => (
      <div className="puck-custom-field rounded-md border border-border bg-card p-3">
        <ReadOnlyWrapper readOnly={readOnly}>{children}</ReadOnlyWrapper>
      </div>
    ),
    // Replace Puck's native select (which shows CSS-triangle indicators on hover)
    // with our shadcn/ui Select so styling is consistent with the rest of the UI.
    select: (({
      field,
      value,
      onChange,
      readOnly,
    }: {
      field: {
        options?: Array<{ label: string; value: string | number | boolean }>;
      };
      value: string | number | boolean;
      onChange: (value: string | number | boolean) => void;
      readOnly?: boolean;
    }) => (
      <ReadOnlyWrapper readOnly={readOnly}>
        <Select
          disabled={readOnly}
          onValueChange={(v) => onChange(v)}
          value={String(value ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ReadOnlyWrapper>
    )) as never,
    image: ({ value, onChange, readOnly, name }: PuckFieldProps) => (
      <ReadOnlyWrapper readOnly={readOnly}>
        <FileUpload
          getImages={listImages}
          name={name}
          onChange={(fileOrUrl) => {
            if (readOnly) {
              return;
            }

            if (fileOrUrl instanceof File) {
              uploadImage(fileOrUrl)
                .then((url) => onChange(url))
                .catch(() => onChange(null));
              return;
            }

            if (typeof fileOrUrl === "string" || fileOrUrl === null) {
              onChange(fileOrUrl);
            }
          }}
          value={
            value instanceof File || typeof value === "string" ? value : null
          }
        />
      </ReadOnlyWrapper>
    ),
    link: ({ value, onChange, readOnly }: PuckFieldProps) => (
      <ReadOnlyWrapper readOnly={readOnly}>
        <LinkPicker
          getPages={getPages}
          onChange={(next) => {
            if (!readOnly) {
              onChange(next);
            }
          }}
          value={typeof value === "string" ? value : ""}
        />
      </ReadOnlyWrapper>
    ),
    "table-picker": ({ value, onChange, readOnly }: PuckFieldProps) => (
      <ReadOnlyWrapper readOnly={readOnly}>
        <TablePicker
          getTables={getTables}
          onChange={(next) => {
            if (!readOnly) {
              onChange(next);
            }
          }}
          value={(value ?? {}) as Record<string, unknown>}
        />
      </ReadOnlyWrapper>
    ),
    "datetime-picker": ({ value, onChange, readOnly }: PuckFieldProps) => (
      <ReadOnlyWrapper readOnly={readOnly}>
        <DateTimePicker
          label="Publish date"
          onChange={(next) => {
            if (!readOnly) onChange(next);
          }}
          readOnly={readOnly}
          value={typeof value === "string" ? value : null}
        />
      </ReadOnlyWrapper>
    ),
  },
};

export const puckViewports = [
  {
    label: "Wide",
    width: 1920,
    height: "auto" as const,
    icon: <Monitor size={20} />,
  },
  {
    label: "Desktop",
    width: 1280,
    height: "auto" as const,
    icon: <Laptop size={20} />,
  },
  {
    label: "Tablet",
    width: 768,
    height: "auto" as const,
    icon: <Tablet size={20} />,
  },
  {
    label: "Mobile",
    width: 375,
    height: "auto" as const,
    icon: <Smartphone size={20} />,
  },
];
