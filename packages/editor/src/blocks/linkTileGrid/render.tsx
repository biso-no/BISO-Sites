"use client";

import type { PatchFn } from "@/blocks/types";
import type { LinkTileGridBlock } from "@/editor/types";

interface Props {
  block: LinkTileGridBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function LinkTileGridRender({ block, edit }: Props) {
  return (
    <div className="pg-linktiles pg-block">
      {block.heading && <h2 className="pg-linktiles__h">{block.heading}</h2>}
      <div className="pg-linktiles__grid">
        {block.items.map((item, i) => {
          const inner = (
            <>
              <span aria-hidden="true" className="pg-linktiles__icon">
                {item.icon}
              </span>
              <span className="pg-linktiles__title">{item.title}</span>
              {item.description && (
                <span className="pg-linktiles__desc">{item.description}</span>
              )}
            </>
          );
          return edit ? (
            <div className="pg-linktiles__tile" key={i}>
              {inner}
            </div>
          ) : (
            <a className="pg-linktiles__tile" href={item.href} key={i}>
              {inner}
            </a>
          );
        })}
      </div>
    </div>
  );
}
