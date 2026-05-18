"use client";

import { FileText, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { STUDIO } from "./studio";

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
            background: "rgba(255,255,255,0.5)",
            border: `0.5px solid ${STUDIO.rule2}`,
          }}
        >
          <FileText size={20} style={{ color: STUDIO.claret, flexShrink: 0 }} />
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-medium text-sm"
              style={{ color: STUDIO.ink }}
            >
              {value.name}
            </p>
            <p className="text-xs" style={{ color: STUDIO.ink4 }}>
              {formatBytes(value.size)}
            </p>
          </div>
          <button
            className="shrink-0 rounded-lg p-1.5 transition-colors"
            onClick={() => onChange(null)}
            style={{ background: "rgba(107,30,30,0.10)", color: STUDIO.claret }}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          className="cursor-pointer rounded-xl px-4 py-6 text-center transition-all"
          onClick={() => inputRef.current?.click()}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            background: isDragging
              ? "rgba(107,30,30,0.06)"
              : "rgba(255,255,255,0.42)",
            border: `1px dashed ${isDragging ? STUDIO.claret : STUDIO.rule2}`,
          }}
          type="button"
        >
          <Upload
            className="mx-auto mb-2"
            size={22}
            style={{ color: STUDIO.ink4 }}
          />
          <p className="text-sm" style={{ color: STUDIO.ink3 }}>
            Click or drag a PDF file here
          </p>
          <p className="mt-1 text-xs" style={{ color: STUDIO.ink4 }}>
            Max 50 MB
          </p>
        </button>
      )}
    </div>
  );
}
