"use client";

import type { PatchFn } from "@/blocks/types";
import type { FaqBlock } from "@/editor/types";

interface Props {
  block: FaqBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function FaqRender({ block, edit, onPatch }: Props) {
  return (
    <div className={`pg-faq pg-faq--${block.variant ?? "list"} pg-block`}>
      {edit ? (
        <h2
          contentEditable
          data-edit="1"
          onBlur={(e) => onPatch("heading", e.currentTarget.textContent ?? "")}
          suppressContentEditableWarning
        >
          {block.heading}
        </h2>
      ) : (
        <h2>{block.heading}</h2>
      )}
      <div className="pg-faq-list">
        {block.items.map((item, i) => (
          <div className="pg-faq-item" key={i}>
            {edit ? (
              <p
                className="pg-faq-item__q"
                contentEditable
                data-edit="1"
                onBlur={(e) => {
                  const items = block.items.map((x, j) =>
                    j === i ? { ...x, q: e.currentTarget.textContent ?? "" } : x
                  );
                  onPatch("items", items);
                }}
                suppressContentEditableWarning
              >
                {item.q}
              </p>
            ) : (
              <p className="pg-faq-item__q">{item.q}</p>
            )}
            {edit ? (
              <p
                className="pg-faq-item__a"
                contentEditable
                data-edit="1"
                onBlur={(e) => {
                  const items = block.items.map((x, j) =>
                    j === i ? { ...x, a: e.currentTarget.textContent ?? "" } : x
                  );
                  onPatch("items", items);
                }}
                suppressContentEditableWarning
              >
                {item.a}
              </p>
            ) : (
              <p className="pg-faq-item__a">{item.a}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
