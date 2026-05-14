"use client";

import { FileText, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

interface PdfUploadFieldProps {
  onChange: (file: File | null) => void;
  value: File | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PdfUploadField({ value, onChange }: PdfUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      return;
    }
    onChange(file);
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
      <input
        accept="application/pdf"
        className="sr-only"
        onChange={handleInputChange}
        ref={inputRef}
        type="file"
      />

      {value ? (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: "rgba(61,169,224,0.08)",
            border: "1px solid rgba(61,169,224,0.25)",
          }}
        >
          <FileText size={20} style={{ color: "#3DA9E0", flexShrink: 0 }} />
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-medium text-sm"
              style={{ color: "#fff" }}
            >
              {value.name}
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
              {formatBytes(value.size)}
            </p>
          </div>
          <button
            className="shrink-0 rounded-lg p-1.5 transition-colors"
            onClick={() => onChange(null)}
            style={{ background: "rgba(248,113,113,0.10)", color: "#f87171" }}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          className="cursor-pointer rounded-xl px-4 py-6 text-center transition-all"
          onClick={() => inputRef.current?.click()}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="button"
          style={{
            background: isDragging
              ? "rgba(61,169,224,0.08)"
              : "rgba(255,255,255,0.02)",
            border: `1px dashed ${isDragging ? "rgba(61,169,224,0.50)" : "rgba(255,255,255,0.12)"}`,
          }}
          tabIndex={0}
        >
          <Upload
            className="mx-auto mb-2"
            size={22}
            style={{ color: "rgba(255,255,255,0.25)" }}
          />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.50)" }}>
            Click or drag a PDF file here
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            Max 50 MB
          </p>
        </div>
      )}
    </div>
  );
}
