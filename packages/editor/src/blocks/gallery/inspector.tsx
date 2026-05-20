"use client";

import { useRef, useState, useTransition } from "react";
import type { PatchFn } from "@/blocks/types";
import { InspSection } from "@/components/editor-shell/inspector/insp-parts";
import { useEditorCallbacks } from "@/editor/callbacks";
import type { GalleryBlock, GalleryImage } from "@/editor/types";

interface Props {
  block: GalleryBlock;
  onPatch: PatchFn;
}

export function GalleryInspector({ block, onPatch }: Props) {
  const { uploadFile } = useEditorCallbacks();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const images = block.images ?? [];

  function handleDrop(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === toIdx) {
      return;
    }
    const updated = [...images];
    const [item] = updated.splice(dragIdx, 1);
    updated.splice(toIdx, 0, item);
    onPatch("images", updated);
    setDragIdx(null);
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) {
      return;
    }
    startTransition(async () => {
      const added: GalleryImage[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const { fileId, url } = await uploadFile(fd);
        added.push({ fileId, src: url });
      }
      onPatch("images", [...images, ...added]);
    });
    e.target.value = "";
  }

  return (
    <InspSection label="Gallery images">
      {images.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>
          No images yet.
        </p>
      )}
      {images.map((img, i) => (
        <div
          draggable
          key={img.fileId ?? i}
          onDragOver={(e) => e.preventDefault()}
          onDragStart={() => setDragIdx(i)}
          onDrop={(e) => handleDrop(e, i)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 0",
            cursor: "grab",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            src={img.src ?? ""}
            style={{
              width: 40,
              height: 40,
              objectFit: "cover",
              borderRadius: 6,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              fontSize: 11,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--ink-2)",
            }}
          >
            {img.src
              ? (img.src.split("/").pop()?.split("?")[0] ?? img.src)
              : (img.fileId ?? "")}
          </span>
          <button
            onClick={() =>
              onPatch(
                "images",
                images.filter((_, idx) => idx !== i)
              )
            }
            style={{
              flexShrink: 0,
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: 0,
              background: "var(--rule-2)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: 10,
            }}
            type="button"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        disabled={isPending}
        onClick={() => fileRef.current?.click()}
        style={{
          marginTop: 8,
          width: "100%",
          padding: "6px 0",
          border: "0.5px dashed var(--rule-2)",
          borderRadius: 6,
          background: "transparent",
          fontSize: 12,
          cursor: "pointer",
          color: "var(--ink-3)",
        }}
        type="button"
      >
        {isPending ? "Uploading…" : "+ Add images"}
      </button>

      <input
        accept="image/*"
        multiple
        onChange={handleFiles}
        ref={fileRef}
        style={{ display: "none" }}
        type="file"
      />
    </InspSection>
  );
}
