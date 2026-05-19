"use client";

import type { TimelineBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: TimelineBlock; edit: boolean; onPatch: PatchFn; }

export function TimelineRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-timeline pg-block">
      {edit ? (
        <h2
          contentEditable suppressContentEditableWarning data-edit="1"
          onBlur={(e) => onPatch("heading", e.currentTarget.textContent ?? "")}
        >{block.heading}</h2>
      ) : (
        <h2>{block.heading}</h2>
      )}
      <div className="pg-timeline-list">
        {(block.items || []).map((it, i) => (
          <div key={i} className="pg-timeline-item">
            {edit ? (
              <div
                className="pg-timeline-item__year"
                contentEditable suppressContentEditableWarning data-edit="1"
                onBlur={(e) => onPatch(`items.${i}.year`, e.currentTarget.textContent ?? "")}
              >{it.year}</div>
            ) : (
              <div className="pg-timeline-item__year">{it.year}</div>
            )}
            {edit ? (
              <div
                className="pg-timeline-item__text"
                contentEditable suppressContentEditableWarning data-edit="1"
                onBlur={(e) => onPatch(`items.${i}.text`, e.currentTarget.textContent ?? "")}
              >{it.text}</div>
            ) : (
              <div className="pg-timeline-item__text">{it.text}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
