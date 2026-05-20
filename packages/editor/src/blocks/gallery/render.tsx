"use client";

import { useRef, useTransition } from "react";
import type { PatchFn } from "@/blocks/types";
import { useEditorCallbacks } from "@/editor/callbacks";
import type { GalleryBlock, GalleryImage } from "@/editor/types";

interface Props {
  block: GalleryBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function GalleryRender({ block, edit, onPatch }: Props) {
  const { uploadFile } = useEditorCallbacks();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) {
      return;
    }
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
        <div
          className={`pg-gallery__tile${i === 0 ? "big" : ""}`}
          key={img.fileId ?? img.src ?? i}
        >
          {img.src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={img.src} />
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
