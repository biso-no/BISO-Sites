"use client";

import type { SignupBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: SignupBlock; edit: boolean; onPatch: PatchFn; }

export function SignupRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-signup pg-block">
      {edit ? (
        <h2
          contentEditable suppressContentEditableWarning data-edit="1"
          onBlur={(e) => onPatch("heading", e.currentTarget.textContent ?? "")}
        >{block.heading}</h2>
      ) : (
        <h2>{block.heading}</h2>
      )}
      <div className="pg-signup__form">
        <input placeholder={block.placeholder || "you@bi.no"} readOnly={!edit} />
        <button type="button">Subscribe</button>
      </div>
    </div>
  );
}
