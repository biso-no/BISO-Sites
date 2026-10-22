"use client";

import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { MAX_UPLOAD_BYTES, uploadMediaFile } from "@/lib/upload-client";
import { STUDIO } from "./studio";

interface ImageUploadFieldProps {
  /** `contain` shows the whole image, as a logo needs; `cover` fills. */
  fit?: "contain" | "cover";
  inputId?: string;
  label?: string;
  onChange: (url: string | null) => void;
  /** For images that may live outside `images.remotePatterns`. */
  unoptimized?: boolean;
  value: string | null;
}

export function ImageUploadField({
  fit = "cover",
  inputId,
  label,
  value,
  onChange,
  unoptimized,
}: ImageUploadFieldProps) {
  const t = useTranslations("adminPortal.common.imageUpload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    // Caught here rather than by the upload, so the reason is given in the
    // editor's language.
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t("uploadFailed"), { description: t("tooLarge") });
      return;
    }
    startTransition(async () => {
      const result = await uploadMediaFile(file);
      if (result.error) {
        // The reason is English and for developers; it stays here.
        console.warn("[upload] image upload failed:", result.error);
        toast.error(t("uploadFailed"));
      } else {
        onChange(result.url ?? null);
        toast.success(t("uploaded"));
      }
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  return (
    <div className="space-y-2">
      {/* Hidden file input */}
      <input
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        aria-label={label ?? t("uploadLabel")}
        className="sr-only"
        id={inputId}
        onChange={handleInputChange}
        ref={inputRef}
        type="file"
      />

      {/* Preview or drop zone */}
      {value ? (
        // The frame sets the height: a `fill` image takes its size from it.
        <div
          className="group relative h-40 overflow-hidden rounded-xl"
          style={{
            background: fit === "contain" ? "#fff" : undefined,
            border: `0.5px solid ${STUDIO.rule2}`,
          }}
        >
          <Image
            alt={t("alt")}
            className={
              fit === "contain" ? "object-contain p-4" : "object-cover"
            }
            fill
            src={value}
            unoptimized={unoptimized}
          />
          {/* Shown on hover, and while a button in it has keyboard focus. */}
          <div
            className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all"
              disabled={isPending}
              onClick={() => inputRef.current?.click()}
              style={{ background: STUDIO.paper, color: STUDIO.ink }}
              type="button"
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={13} />
              ) : (
                <Upload size={13} />
              )}
              {t("replace")}
            </button>
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all"
              onClick={() => onChange(null)}
              style={{
                background: "rgba(107,30,30,0.12)",
                color: STUDIO.claret,
              }}
              type="button"
            >
              <X size={13} />
              {t("remove")}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl transition-all"
          onClick={() => inputRef.current?.click()}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            height: 140,
            border: isDragging
              ? `1.5px dashed ${STUDIO.claret}`
              : `1.5px dashed ${STUDIO.rule2}`,
            background: isDragging
              ? "rgba(107,30,30,0.05)"
              : "rgba(255,255,255,0.42)",
          }}
          type="button"
        >
          {isPending ? (
            <Loader2
              className="animate-spin"
              size={22}
              style={{ color: STUDIO.claret }}
            />
          ) : (
            <>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: STUDIO.paper2,
                  border: `0.5px solid ${STUDIO.rule2}`,
                }}
              >
                <ImageIcon size={18} style={{ color: STUDIO.claret }} />
              </div>
              <div className="text-center">
                <p
                  className="font-medium text-xs"
                  style={{ color: STUDIO.ink3 }}
                >
                  {t("dropOrBrowse")}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
                  {t("formats")}
                </p>
              </div>
            </>
          )}
        </button>
      )}
    </div>
  );
}
