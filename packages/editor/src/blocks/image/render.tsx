"use client";

import type { PatchFn } from "@/blocks/types";
import type { ImageBlock } from "@/editor/types";

interface Props {
  block: ImageBlock;
  edit: boolean;
  onPatch: PatchFn;
}

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
          <img
            alt={block.caption}
            height={675}
            src={src}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            width={1200}
          />
        ) : (
          <span
            style={{
              fontSize: 12,
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
            }}
          >
            {edit ? "Select an image in the inspector →" : "No image"}
          </span>
        )}
      </div>
      {(block.caption || edit) && (
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: contentEditable and editor preview controls intentionally use custom interaction surfaces.
        <p
          className="pg-image__caption"
          contentEditable={edit || undefined}
          data-edit={edit ? "1" : undefined}
          onBlur={
            edit
              ? (e) => onPatch("caption", e.currentTarget.textContent ?? "")
              : undefined
          }
          role={edit ? "textbox" : undefined}
          suppressContentEditableWarning
          tabIndex={edit ? 0 : undefined}
        >
          {block.caption || (edit ? "Caption…" : "")}
        </p>
      )}
    </div>
  );
}
