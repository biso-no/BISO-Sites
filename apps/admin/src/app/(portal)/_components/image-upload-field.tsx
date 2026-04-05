"use client";

import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadMediaFile } from "../_actions/upload";

interface ImageUploadFieldProps {
  label?: string;
  onChange: (url: string | null) => void;
  value: string | null;
}

export function ImageUploadField({ value, onChange }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const result = await uploadMediaFile(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        onChange(result.url);
        toast.success("Image uploaded");
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

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
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
        className="sr-only"
        onChange={handleInputChange}
        ref={inputRef}
        type="file"
      />

      {/* Preview or drop zone */}
      {value ? (
        <div
          className="group relative overflow-hidden rounded-xl"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Image
            alt="Cover"
            className="h-40 w-full object-cover"
            fill
            src={value}
          />
          <div
            className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all"
              disabled={isPending}
              onClick={() => inputRef.current?.click()}
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
              type="button"
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={13} />
              ) : (
                <Upload size={13} />
              )}
              Replace
            </button>
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all"
              onClick={() => onChange(null)}
              style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}
              type="button"
            >
              <X size={13} />
              Remove
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
              ? "1.5px dashed rgba(61,169,224,0.60)"
              : "1.5px dashed rgba(255,255,255,0.12)",
            background: isDragging
              ? "rgba(61,169,224,0.06)"
              : "rgba(255,255,255,0.02)",
          }}
          type="button"
        >
          {isPending ? (
            <Loader2
              className="animate-spin"
              size={22}
              style={{ color: "#3DA9E0" }}
            />
          ) : (
            <>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(61,169,224,0.10)",
                  border: "1px solid rgba(61,169,224,0.20)",
                }}
              >
                <ImageIcon size={18} style={{ color: "#3DA9E0" }} />
              </div>
              <div className="text-center">
                <p
                  className="font-medium text-xs"
                  style={{ color: "rgba(255,255,255,0.60)" }}
                >
                  Drop image or <span style={{ color: "#3DA9E0" }}>browse</span>
                </p>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  JPG, PNG, GIF, WEBP, SVG · max 10 MB
                </p>
              </div>
            </>
          )}
        </button>
      )}
    </div>
  );
}
