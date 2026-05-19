"use client";

import type { CtaBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: CtaBlock; edit: boolean; onPatch: PatchFn; }

export function CtaRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-cta pg-block">
      {edit ? (
        <h2 contentEditable suppressContentEditableWarning data-edit="1"
          onBlur={(e) => onPatch("title", e.currentTarget.textContent ?? "")}
        >{block.title}</h2>
      ) : <h2>{block.title}</h2>}
      {edit ? (
        <button className="pg-cta__btn" type="button"
          contentEditable suppressContentEditableWarning data-edit="1"
          onBlur={(e) => onPatch("label", e.currentTarget.textContent ?? "")}
        >{block.label}</button>
      ) : (
        <a className="pg-cta__btn" href={block.url}>{block.label}</a>
      )}
    </div>
  );
}
