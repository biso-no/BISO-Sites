"use client";

import type { Config, Overrides } from "@puckeditor/core";
import type { DataSourceValue } from "@repo/ui/components/data-source-picker";
import { DataSourcePicker } from "@repo/ui/components/data-source-picker";
import { FileUpload } from "@repo/ui/components/file-upload";
import { LinkPicker } from "@repo/ui/components/link-picker";
import { TablePicker } from "@repo/ui/components/table-picker";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { ReactNode } from "react";
import { TABLE_SCHEMAS } from "./data/schemas";
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
      "data-source": ({ value, onChange, readOnly, field }: PuckFieldProps) => {
        const fieldConfig = (field ?? {}) as {
          schemas?: unknown;
          showLimit?: boolean;
          showSort?: boolean;
          maxLimit?: number;
        };

        return (
          <ReadOnlyWrapper readOnly={readOnly}>
            <DataSourcePicker
              maxLimit={fieldConfig.maxLimit ?? 100}
              onChange={(next: DataSourceValue) => {
                if (!readOnly) {
                  onChange(next);
                }
              }}
              schemas={(fieldConfig.schemas ?? TABLE_SCHEMAS) as never}
              showLimit={fieldConfig.showLimit ?? true}
              showSort={fieldConfig.showSort ?? true}
              value={(value ?? {}) as DataSourceValue}
            />
          </ReadOnlyWrapper>
        );
      },
    },
  };
}

export const puckViewports = [
  {
    label: "Desktop",
    width: 1280,
    height: "auto" as const,
    icon: <Monitor size={20} />,
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
