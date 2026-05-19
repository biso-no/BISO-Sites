"use client";

import { useRef, useTransition } from "react";
import type { GalleryBlock, GalleryImage } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { useEditorCallbacks } from "@/editor/callbacks";

interface Props { block: GalleryBlock; edit: boolean; onPatch: PatchFn; }

export function GalleryRender({ block, edit, onPatch }: Props) {
  const { uploadFile } = useEditorCallbacks();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    startTransition(async () => {
      const newImages: GalleryImage[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const { fileId, url } = await uploadFile(fd);
        newImages.push({ fileId, src: url });
      }
      onPatch("images", [...(block.images || []), ...newImages]);
    });
  }

  const images = block.images || [];

  return (
    <div className="pg-gallery pg-block">
      {images.map((img, i) => (
        <div key={i} className={`pg-gallery__tile${i === 0 ? " big" : ""}`}>
          {img.src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.src} alt="" />
          )}
          {edit && (
            <button
              type="button"
              onClick={() => {
                const updated = images.filter((_, idx) => idx !== i);
                onPatch("images", updated);
              }}
              aria-label="Remove"
              style={{
                position: "absolute", top: 6, right: 6, width: 22, height: 22,
                borderRadius: "50%", border: 0, background: "rgba(26,24,20,.6)",
                color: "#fff", fontSize: 11, cursor: "pointer", display: "grid", placeItems: "center", zIndex: 1,
              }}
            >✕</button>
          )}
        </div>
      ))}
      {edit && (
        <button
          type="button"
          className="pg-gallery__add"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
        >
          {isPending ? "…" : "+"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFiles}
      />
    </div>
  );
}
