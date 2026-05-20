"use client";

import type { StepGridBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: StepGridBlock; edit: boolean; onPatch: PatchFn; }

export function StepGridRender({ block }: Props) {
  return (
    <div className="pg-stepgrid pg-block">
      {block.heading && <h2 className="pg-stepgrid__h">{block.heading}</h2>}
      <div className="pg-stepgrid__grid">
        {block.items.map((item, i) => (
          <div key={i} className="pg-stepgrid__card">
            <div className="pg-stepgrid__num">{item.number}</div>
            <div className="pg-stepgrid__title">{item.title}</div>
            <p className="pg-stepgrid__body">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
