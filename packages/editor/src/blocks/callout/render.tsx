"use client";

import type { CalloutBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: CalloutBlock; edit: boolean; onPatch: PatchFn; }

export function CalloutRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-callout-wrap pg-block">
      <div className="pg-callout">
        <div className="pg-callout__ic" aria-hidden="true">✦</div>
        <div className="pg-callout__body">
          {edit ? (
            <b contentEditable suppressContentEditableWarning data-edit="1"
              onBlur={(e) => onPatch("title", e.currentTarget.textContent ?? "")}
            >{block.title}</b>
          ) : <b>{block.title}</b>}
          {edit ? (
            <p contentEditable suppressContentEditableWarning data-edit="1"
              onBlur={(e) => onPatch("body", e.currentTarget.textContent ?? "")}
            >{block.body}</p>
          ) : <p>{block.body}</p>}
        </div>
      </div>
    </div>
  );
}
