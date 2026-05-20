"use client";

import type { FaqBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: FaqBlock; edit: boolean; onPatch: PatchFn; }

export function FaqRender({ block, edit, onPatch }: Props) {
  return (
    <div className={`pg-faq pg-faq--${block.variant ?? "list"} pg-block`}>
      {edit ? (
        <h2 contentEditable suppressContentEditableWarning data-edit="1"
          onBlur={(e) => onPatch("heading", e.currentTarget.textContent ?? "")}
        >{block.heading}</h2>
      ) : <h2>{block.heading}</h2>}
      <div className="pg-faq-list">
        {block.items.map((item, i) => (
          <div key={i} className="pg-faq-item">
            {edit ? (
              <p className="pg-faq-item__q" contentEditable suppressContentEditableWarning data-edit="1"
                onBlur={(e) => {
                  const items = block.items.map((x, j) => j === i ? { ...x, q: e.currentTarget.textContent ?? "" } : x);
                  onPatch("items", items);
                }}
              >{item.q}</p>
            ) : <p className="pg-faq-item__q">{item.q}</p>}
            {edit ? (
              <p className="pg-faq-item__a" contentEditable suppressContentEditableWarning data-edit="1"
                onBlur={(e) => {
                  const items = block.items.map((x, j) => j === i ? { ...x, a: e.currentTarget.textContent ?? "" } : x);
                  onPatch("items", items);
                }}
              >{item.a}</p>
            ) : <p className="pg-faq-item__a">{item.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
