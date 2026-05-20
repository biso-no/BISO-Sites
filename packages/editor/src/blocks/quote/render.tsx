"use client";

import type { QuoteBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: QuoteBlock; edit: boolean; onPatch: PatchFn; }

export function QuoteRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-quote pg-block">
      <div className="pg-quote__mark" aria-hidden="true">"</div>
      {edit ? (
        <div
          className="pg-quote__body"
          contentEditable suppressContentEditableWarning data-edit="1"
          onBlur={(e) => onPatch("text", e.currentTarget.textContent ?? "")}
        >{block.text}</div>
      ) : (
        <div className="pg-quote__body">{block.text}</div>
      )}
      <div className="pg-quote__attrib">
        <div className="pg-quote__av" aria-hidden="true">
          {(block.author || "?").split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2)}
        </div>
        <div>
          {edit ? (
            <b
              contentEditable suppressContentEditableWarning data-edit="1"
              onBlur={(e) => onPatch("author", e.currentTarget.textContent ?? "")}
            >{block.author}</b>
          ) : (
            <b>{block.author}</b>
          )}
          {", "}
          {edit ? (
            <span
              contentEditable suppressContentEditableWarning data-edit="1"
              onBlur={(e) => onPatch("role", e.currentTarget.textContent ?? "")}
            >{block.role}</span>
          ) : (
            <span>{block.role}</span>
          )}
        </div>
      </div>
    </div>
  );
}
