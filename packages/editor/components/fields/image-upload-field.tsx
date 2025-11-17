"use client";

import { useState, useRef } from "react";
import type { Field } from "@measured/puck";
import { FieldLabel } from "@measured/puck";
import { Button } from "@repo/ui/components/ui/button";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import type { ImageData } from "../../types";

export type ImageUploadFieldProps = {
  field: Field<ImageData>;
  name: string;
  value?: ImageData;
  onChange: (value: ImageData | undefined) => void;
  readOnly?: boolean;
};

export function ImageUploadField({
  field,
  name,
  value,
  onChange,
  readOnly,
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      // Create FormData and upload
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data) {
        onChange({
          type: "upload",
          fileId: result.data.id,
          url: result.data.url,
          alt: "",
        });
      } else {
        setError(result.error || "Upload failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (value?.fileId) {
      try {
        // Call delete endpoint
        await fetch("/api/admin/delete-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: value.fileId }),
        });
      } catch (err) {
        console.error("Failed to delete image:", err);
      }
    }
    onChange(undefined);
  };

  return (
    <FieldLabel label={field.label || name}>
      <div className="space-y-3">
        {value?.url ? (
          <div className="relative">
            <div className="group relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <img
                src={value.url}
                alt={value.alt || "Uploaded image"}
                className="h-full w-full object-cover"
              />
              {!readOnly && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={handleRemove}
                    disabled={uploading}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
            {!readOnly && (
              <input
                type="text"
                className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                placeholder="Alt text (optional)"
                value={value.alt || ""}
                onChange={(e) =>
                  onChange({ ...value, alt: e.target.value })
                }
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8">
            <ImageIcon className="mb-2 h-12 w-12 text-gray-400" />
            <p className="mb-4 text-sm text-gray-600">
              {uploading ? "Uploading..." : "No image selected"}
            </p>
            {!readOnly && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Uploading..." : "Upload Image"}
                </Button>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <p className="text-xs text-gray-500">
          Maximum file size: 10MB. Supported formats: JPG, PNG, GIF, WebP
        </p>
      </div>
    </FieldLabel>
  );
}

// Field configuration for use in Puck config
export const imageUploadField = {
  type: "custom",
  render: ImageUploadField,
} as const;

