"use client";

import type { PatchFn } from "@/blocks/types";
import type { ScrollRowBlock } from "@/editor/types";

interface Props {
  block: ScrollRowBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function ScrollRowRender({ block, edit }: Props) {
  return (
    <div className="pg-scrollrow pg-block">
      {block.heading && <h2 className="pg-scrollrow__h">{block.heading}</h2>}
      <div className="pg-scrollrow__track">
        {block.items.map((item, i) => {
          const inner = (
            <>
              {item.icon && (
                <div aria-hidden="true" className="pg-scrollrow__icon">
                  {item.icon}
                </div>
              )}
              <div className="pg-scrollrow__title">{item.title}</div>
              <p className="pg-scrollrow__body">{item.body}</p>
            </>
          );
          return item.href && !edit ? (
            <a className="pg-scrollrow__card" href={item.href} key={i}>
              {inner}
            </a>
          ) : (
            <div className="pg-scrollrow__card" key={i}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
