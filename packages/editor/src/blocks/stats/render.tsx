"use client";

import type { PatchFn } from "@/blocks/types";
import type { StatsBlock } from "@/editor/types";

interface Props {
  block: StatsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function StatsRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-stats pg-block">
      {block.items.map((item, i) => (
        <div className="pg-stat" key={i}>
          {edit ? (
            <div
              className="pg-stat__num"
              contentEditable
              data-edit="1"
              onBlur={(e) => {
                const items = block.items.map((x, j) =>
                  j === i ? { ...x, num: e.currentTarget.textContent ?? "" } : x
                );
                onPatch("items", items);
              }}
              suppressContentEditableWarning
            >
              {item.num}
            </div>
          ) : (
            <div className="pg-stat__num">{item.num}</div>
          )}
          {edit ? (
            <div
              className="pg-stat__lbl"
              contentEditable
              data-edit="1"
              onBlur={(e) => {
                const items = block.items.map((x, j) =>
                  j === i
                    ? { ...x, label: e.currentTarget.textContent ?? "" }
                    : x
                );
                onPatch("items", items);
              }}
              suppressContentEditableWarning
            >
              {item.label}
            </div>
          ) : (
            <div className="pg-stat__lbl">{item.label}</div>
          )}
        </div>
      ))}
    </div>
  );
}
