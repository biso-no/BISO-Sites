"use client";

import type { StatsBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: StatsBlock; edit: boolean; onPatch: PatchFn; }

export function StatsRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-stats pg-block">
      {block.items.map((item, i) => (
        <div key={i} className="pg-stat">
          {edit ? (
            <div
              className="pg-stat__num"
              contentEditable suppressContentEditableWarning data-edit="1"
              onBlur={(e) => {
                const items = block.items.map((x, j) => j === i ? { ...x, num: e.currentTarget.textContent ?? "" } : x);
                onPatch("items", items);
              }}
            >{item.num}</div>
          ) : (
            <div className="pg-stat__num">{item.num}</div>
          )}
          {edit ? (
            <div
              className="pg-stat__lbl"
              contentEditable suppressContentEditableWarning data-edit="1"
              onBlur={(e) => {
                const items = block.items.map((x, j) => j === i ? { ...x, label: e.currentTarget.textContent ?? "" } : x);
                onPatch("items", items);
              }}
            >{item.label}</div>
          ) : (
            <div className="pg-stat__lbl">{item.label}</div>
          )}
        </div>
      ))}
    </div>
  );
}
