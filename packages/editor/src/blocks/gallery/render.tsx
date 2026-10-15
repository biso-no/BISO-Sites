"use client";

import { useRef, useState, useTransition } from "react";
import type { PatchFn } from "@/blocks/types";
import { useEditorCallbacks } from "@/editor/callbacks";
import type { GalleryBlock } from "@/editor/types";
import { uploadGalleryFiles } from "./upload";

interface Props {
  block: GalleryBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function GalleryRender({ block, edit, onPatch }: Props) {
  const { uploadFile } = useEditorCallbacks();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) {
      return;
    }
    setUploadError(null);
    startTransition(async () => {
      const { added, error } = await uploadGalleryFiles(files, uploadFile);
      if (added.length > 0) {
        onPatch("images", [...(block.images || []), ...added]);
      }
      setUploadError(error);
    });
    // Reset so picking the same file again re-fires the change event.
    e.target.value = "";
  }

  const images = block.images || [];

  return (
    <div className="pg-gallery pg-block">
      {images.map((img, i) => (
        <div
          className={`pg-gallery__tile ${i === 0 ? "big" : ""}`}
          key={img.fileId ?? img.src ?? i}
        >
          {img.src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" height={675} src={img.src} width={1200} />
          )}
          {edit && (
            <button
              aria-label="Remove"
              onClick={() => {
                const updated = images.filter((_, idx) => idx !== i);
                onPatch("images", updated);
              }}
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
                zIndex: 1,
              }}
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {edit && (
        <button
          className="pg-gallery__add"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {isPending ? "…" : "+"}
        </button>
      )}
      {edit && uploadError && (
        <p
          className="pg-gallery__error"
          role="alert"
          style={{ color: "#b42318", fontSize: 12, gridColumn: "1 / -1" }}
        >
          {uploadError}
        </p>
      )}
      <input
        accept="image/*"
        multiple
        onChange={handleFiles}
        ref={inputRef}
        style={{ display: "none" }}
        type="file"
      />
    </div>
  );
}
