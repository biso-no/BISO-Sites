"use client";

import { useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { uploadMediaFile } from "../_actions/upload";

type ImageUploadFieldProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
};

export function ImageUploadField({ value, onChange, label }: ImageUploadFieldProps) {
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
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
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
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        className="sr-only"
        onChange={handleInputChange}
      />

      {/* Preview or drop zone */}
      {value ? (
        <div className="relative rounded-xl overflow-hidden group" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <img
            src={value}
            alt="Cover"
            className="w-full h-40 object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.55)" }}>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
              onClick={() => inputRef.current?.click()}
              disabled={isPending}
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Replace
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}
              onClick={() => onChange(null)}
            >
              <X size={13} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all"
          style={{
            height: 140,
            border: isDragging
              ? "1.5px dashed rgba(61,169,224,0.60)"
              : "1.5px dashed rgba(255,255,255,0.12)",
            background: isDragging
              ? "rgba(61,169,224,0.06)"
              : "rgba(255,255,255,0.02)",
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isPending ? (
            <Loader2 size={22} className="animate-spin" style={{ color: "#3DA9E0" }} />
          ) : (
            <>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(61,169,224,0.10)", border: "1px solid rgba(61,169,224,0.20)" }}
              >
                <ImageIcon size={18} style={{ color: "#3DA9E0" }} />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.60)" }}>
                  Drop image or <span style={{ color: "#3DA9E0" }}>browse</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                  JPG, PNG, GIF, WEBP, SVG · max 10 MB
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
