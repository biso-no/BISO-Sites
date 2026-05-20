"use client";

import type { LinkTileGridBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: LinkTileGridBlock; edit: boolean; onPatch: PatchFn; }

export function LinkTileGridRender({ block, edit }: Props) {
  return (
    <div className="pg-linktiles pg-block">
      {block.heading && <h2 className="pg-linktiles__h">{block.heading}</h2>}
      <div className="pg-linktiles__grid">
        {block.items.map((item, i) => {
          const inner = (
            <>
              <span className="pg-linktiles__icon" aria-hidden="true">{item.icon}</span>
              <span className="pg-linktiles__title">{item.title}</span>
              {item.description && <span className="pg-linktiles__desc">{item.description}</span>}
            </>
          );
          return edit ? (
            <div key={i} className="pg-linktiles__tile">{inner}</div>
          ) : (
            <a key={i} className="pg-linktiles__tile" href={item.href}>{inner}</a>
          );
        })}
      </div>
    </div>
  );
}
