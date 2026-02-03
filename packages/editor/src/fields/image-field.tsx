"use client";

import type { CustomField } from "@puckeditor/core";
import { FileUpload } from "@repo/ui/components/file-upload";
import { listImages, uploadImage } from "../upload-image";

export function imageField({
  label = "Image",
}: {
  label?: string;
} = {}): CustomField<string | null> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly, name }) => (
      <div aria-disabled={readOnly} className={readOnly ? "opacity-60" : ""}>
        <FileUpload
          getImages={listImages}
          name={label ?? name}
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
          value={typeof value === "string" ? value : null}
        />
      </div>
    ),
  };
}

