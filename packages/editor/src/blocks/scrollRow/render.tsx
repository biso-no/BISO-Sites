"use client";

import type { ScrollRowBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: ScrollRowBlock; edit: boolean; onPatch: PatchFn; }

export function ScrollRowRender({ block, edit }: Props) {
  return (
    <div className="pg-scrollrow pg-block">
      {block.heading && <h2 className="pg-scrollrow__h">{block.heading}</h2>}
      <div className="pg-scrollrow__track">
        {block.items.map((item, i) => {
          const inner = (
            <>
              {item.icon && <div className="pg-scrollrow__icon" aria-hidden="true">{item.icon}</div>}
              <div className="pg-scrollrow__title">{item.title}</div>
              <p className="pg-scrollrow__body">{item.body}</p>
            </>
          );
          return item.href && !edit ? (
            <a key={i} className="pg-scrollrow__card" href={item.href}>{inner}</a>
          ) : (
            <div key={i} className="pg-scrollrow__card">{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
