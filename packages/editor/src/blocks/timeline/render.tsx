"use client";

import type { PatchFn } from "@/blocks/types";
import type { TimelineBlock } from "@/editor/types";

interface Props {
  block: TimelineBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function TimelineRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-timeline pg-block">
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
      <div className="pg-timeline-list">
        {(block.items || []).map((it, i) => (
          <div className="pg-timeline-item" key={i}>
            {edit ? (
              <div
                className="pg-timeline-item__year"
                contentEditable
                data-edit="1"
                onBlur={(e) =>
                  onPatch(`items.${i}.year`, e.currentTarget.textContent ?? "")
                }
                suppressContentEditableWarning
              >
                {it.year}
              </div>
            ) : (
              <div className="pg-timeline-item__year">{it.year}</div>
            )}
            {edit ? (
              <div
                className="pg-timeline-item__text"
                contentEditable
                data-edit="1"
                onBlur={(e) =>
                  onPatch(`items.${i}.text`, e.currentTarget.textContent ?? "")
                }
                suppressContentEditableWarning
              >
                {it.text}
              </div>
            ) : (
              <div className="pg-timeline-item__text">{it.text}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
