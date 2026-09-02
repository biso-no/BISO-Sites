"use client";

import { resolveStorageFileUrl } from "@repo/api/storage";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadMediaFile } from "@/app/(portal)/_actions/upload";
import { STUDIO } from "@/app/(portal)/_components/studio";

/**
 * What gets persisted after an upload.
 *
 * - `fileId` — the bare Appwrite file id (≤36 chars). Required for
 *   `departments.logo`, which is `string(100)`: a full storage view URL is
 *   ~94 characters today and exceeds the column as soon as the endpoint,
 *   bucket, or file id grows, and Appwrite rejects (not truncates) the write.
 *   Every read path expands it again with `resolveStorageFileUrl`.
 * - `url` — the full storage view URL. Used for `departments.hero`, which has
 *   no size limit, so the directly-renderable form is the safer one there.
 */
export type UnitImageStorage = "fileId" | "url";

const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/gif,image/webp,image/svg+xml";

interface UnitImageFieldProps {
  disabled?: boolean;
  labels: {
    browse: string;
    constraints: string;
    remove: string;
    replace: string;
    uploading: string;
  };
  onChange: (value: string | null) => void;
  /** Tailwind height class for the preview/drop area. */
  previewHeightClass?: string;
  storage: UnitImageStorage;
  /** The raw stored column value: a bare file id, a URL, or nothing. */
  value: string | null;
}

export function UnitImageField({
  disabled = false,
  labels,
  onChange,
  previewHeightClass = "h-40",
  storage,
  value,
}: UnitImageFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();

  // The stored value may be either shape (a legacy URL or a bare file id), so
  // always render through the shared resolver rather than the raw column.
  const previewUrl = resolveStorageFileUrl(value);

  const handleFile = (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const result = await uploadMediaFile(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onChange((storage === "fileId" ? result.fileId : result.url) ?? null);
    });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="space-y-2">
      <input
        accept={ACCEPTED_TYPES}
        className="sr-only"
        disabled={disabled || isPending}
        id={inputId}
        onChange={handleInputChange}
        ref={inputRef}
        type="file"
      />

      {previewUrl ? (
        <div
          className={`group relative overflow-hidden rounded-xl ${previewHeightClass}`}
          style={{
            background: STUDIO.paper2,
            border: `0.5px solid ${STUDIO.rule2}`,
          }}
        >
          <Image
            alt=""
            className="object-contain"
            fill
            sizes="320px"
            src={previewUrl}
            unoptimized
          />
          <div
            className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs"
              disabled={disabled || isPending}
              onClick={() => inputRef.current?.click()}
              style={{ background: STUDIO.paper, color: STUDIO.ink }}
              type="button"
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={13} />
              ) : (
                <Upload size={13} />
              )}
              {labels.replace}
            </button>
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs"
              disabled={disabled || isPending}
              onClick={() => onChange(null)}
              style={{
                background: "rgba(107,30,30,0.12)",
                color: STUDIO.claret,
              }}
              type="button"
            >
              <X size={13} />
              {labels.remove}
            </button>
          </div>
        </div>
      ) : (
        <button
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl ${previewHeightClass}`}
          disabled={disabled || isPending}
          onClick={() => inputRef.current?.click()}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDrop={handleDrop}
          style={{
            background: isDragging
              ? "rgba(107,30,30,0.05)"
              : "rgba(255,255,255,0.42)",
            border: `1.5px dashed ${isDragging ? STUDIO.claret : STUDIO.rule2}`,
          }}
          type="button"
        >
          {isPending ? (
            <>
              <Loader2
                className="animate-spin"
                size={22}
                style={{ color: STUDIO.claret }}
              />
              <span className="text-xs" style={{ color: STUDIO.ink4 }}>
                {labels.uploading}
              </span>
            </>
          ) : (
            <>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: STUDIO.paper2,
                  border: `0.5px solid ${STUDIO.rule2}`,
                }}
              >
                <ImageIcon size={18} style={{ color: STUDIO.claret }} />
              </span>
              <span className="text-center">
                <span
                  className="block font-medium text-xs"
                  style={{ color: STUDIO.ink3 }}
                >
                  {labels.browse}
                </span>
                <span
                  className="mt-0.5 block text-xs"
                  style={{ color: STUDIO.ink4 }}
                >
                  {labels.constraints}
                </span>
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
