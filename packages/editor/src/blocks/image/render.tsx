"use client";

import type { ImageBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: ImageBlock; edit: boolean; onPatch: PatchFn; }

export function ImageRender({ block, edit, onPatch }: Props) {
  const src = block.src;
  return (
    <div className="pg-image pg-block">
      <div
        className="pg-image__frame"
        style={{ aspectRatio: block.aspect || "16/9" }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={block.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 12, color: "var(--ink-4)", fontFamily: "var(--mono)" }}>
            {edit ? "Select an image in the inspector →" : "No image"}
          </span>
        )}
      </div>
      {(block.caption || edit) && (
        <p
          className="pg-image__caption"
          contentEditable={edit || undefined}
          suppressContentEditableWarning
          data-edit={edit ? "1" : undefined}
          onBlur={edit ? (e) => onPatch("caption", e.currentTarget.textContent ?? "") : undefined}
        >
          {block.caption || (edit ? "Caption…" : "")}
        </p>
      )}
    </div>
  );
}
