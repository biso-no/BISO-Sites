"use client";

import type { PatchFn } from "@/blocks/types";
import type { CtaBlock } from "@/editor/types";

interface Props {
  block: CtaBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function CtaRender({ block, edit, onPatch }: Props) {
  const variant = block.variant ?? "card";
  return (
    <div className={`pg-cta pg-cta--${variant} pg-block`}>
      {edit ? (
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: contentEditable and editor preview controls intentionally use custom interaction surfaces.
        <h2
          contentEditable
          data-edit="1"
          onBlur={(e) => onPatch("title", e.currentTarget.textContent ?? "")}
          suppressContentEditableWarning
        >
          {block.title}
        </h2>
      ) : (
        <h2>{block.title}</h2>
      )}
      {edit ? (
        <button
          className="pg-cta__btn"
          contentEditable
          data-edit="1"
          onBlur={(e) => onPatch("label", e.currentTarget.textContent ?? "")}
          suppressContentEditableWarning
          type="button"
        >
          {block.label}
        </button>
      ) : (
        <a className="pg-cta__btn" href={block.url}>
          {block.label}
        </a>
      )}
    </div>
  );
}
