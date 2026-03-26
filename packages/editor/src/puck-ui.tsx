"use client";

import type { Config, Overrides } from "@puckeditor/core";
import { FileUpload } from "@repo/ui/components/file-upload";
import { LinkPicker } from "@repo/ui/components/link-picker";
import { TablePicker } from "@repo/ui/components/table-picker";
import { Laptop, Monitor, Smartphone, Tablet } from "lucide-react";
import type { ReactNode } from "react";
import {
  fieldSchemaEditorField,
} from "./fields/field-schema-editor";
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

export function getPuckFieldOverrides(): Partial<Overrides<Config>> {
  return {
    fieldTypes: {
      // Wrap all custom fields in consistent styling
      custom: ({ children, readOnly }: { children: ReactNode; readOnly?: boolean }) => (
        <div className="puck-custom-field rounded-md border border-gray-200 bg-white p-3">
          <ReadOnlyWrapper readOnly={readOnly}>{children}</ReadOnlyWrapper>
        </div>
      ),
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
      "field-schema-editor": ({ value, onChange, readOnly }: PuckFieldProps) => {
        const customField = fieldSchemaEditorField();

        return customField.render({
          field: customField,
          name: "field-schema-editor",
          id: "field-schema-editor",
          value: (value ?? []) as import("@repo/api/editorial").TemplateFieldSchema[],
          onChange: (next) => {
            if (!readOnly) {
              onChange(next);
            }
          },
          readOnly,
        });
      },
    },
  };
}

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
