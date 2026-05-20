"use client";

import { useRef, useState, useTransition } from "react";
import { useEditorCallbacks } from "@/editor/callbacks";

interface MediaPickerProps {
  accept?: string;
  label?: string;
  onClear?: () => void;
  onPicked: (fileId: string, url: string) => void;
  onUrl: (url: string) => void;
  /** Current URL to display (either from Appwrite or external) */
  src?: string;
}

export function MediaPicker({
  src,
  accept = "image/*,video/*",
  label = "Media",
  onPicked,
  onUrl,
  onClear,
}: MediaPickerProps) {
  const { uploadFile } = useEditorCallbacks();
  const inputRef = useRef<HTMLInputElement>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState(src ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      try {
        const { fileId, url } = await uploadFile(fd);
        onPicked(fileId, url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  const isVideo = src && /\.(mp4|mov|webm|ogg)(\?|$)/i.test(src);
  const isEmbed =
    src && /youtu\.?be|youtube\.com|vimeo\.com|player\.vimeo/i.test(src);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Preview */}
      {src && (
        <div
          style={{
            position: "relative",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--paper-3)",
            border: "0.5px solid var(--rule-2)",
          }}
        >
          {isEmbed ? (
            <div
              style={{
                padding: "16px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: 60,
              }}
            >
              <span style={{ fontSize: 18 }}>▶</span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--ink-2)",
                  wordBreak: "break-all",
                }}
              >
                {src}
              </span>
            </div>
          ) : isVideo ? (
            <video
              muted
              src={src}
              style={{
                width: "100%",
                display: "block",
                maxHeight: 160,
                objectFit: "cover",
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              src={src}
              style={{
                width: "100%",
                display: "block",
                maxHeight: 160,
                objectFit: "cover",
              }}
            />
          )}
          {onClear && (
            <button
              aria-label="Remove"
              onClick={onClear}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: 0,
                background: "rgba(26,24,20,.6)",
                color: "#fff",
                fontSize: 11,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Tab row */}
      <div style={{ display: "flex", gap: 4 }}>
        <button
          disabled={isPending}
          onClick={() => {
            setUrlMode(false);
            inputRef.current?.click();
          }}
          style={{
            flex: 1,
            padding: "6px 0",
            borderRadius: 6,
            border: "0.5px solid var(--rule-2)",
            background: urlMode ? "transparent" : "var(--ink)",
            color: urlMode ? "var(--ink)" : "var(--paper)",
            fontSize: 11.5,
            fontWeight: 500,
            cursor: "pointer",
          }}
          type="button"
        >
          {isPending ? "Uploading…" : "↑ Upload"}
        </button>
        <button
          onClick={() => setUrlMode(true)}
          style={{
            flex: 1,
            padding: "6px 0",
            borderRadius: 6,
            border: "0.5px solid var(--rule-2)",
            background: urlMode ? "var(--ink)" : "transparent",
            color: urlMode ? "var(--paper)" : "var(--ink)",
            fontSize: 11.5,
            fontWeight: 500,
            cursor: "pointer",
          }}
          type="button"
        >
          🔗 Use URL
        </button>
      </div>

      {urlMode && (
        <div style={{ display: "flex", gap: 4 }}>
          <input
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://…"
            style={{
              flex: 1,
              fontSize: 12,
              padding: "5px 8px",
              border: "0.5px solid var(--rule-2)",
              borderRadius: 6,
              background: "var(--paper-2)",
              color: "var(--ink)",
            }}
            value={urlDraft}
          />
          <button
            onClick={() => {
              onUrl(urlDraft);
              setUrlMode(false);
            }}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: 0,
              background: "var(--ink)",
              color: "var(--paper)",
              fontSize: 12,
              cursor: "pointer",
            }}
            type="button"
          >
            Set
          </button>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 11, color: "var(--claret)", margin: 0 }}>
          {error}
        </p>
      )}

      <input
        accept={accept}
        onChange={handleFile}
        ref={inputRef}
        style={{ display: "none" }}
        type="file"
      />
    </div>
  );
}
