"use client";

import type { PatchFn } from "@/blocks/types";
import type { ProductGridBlock } from "@/editor/types";

interface Props {
  block: ProductGridBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const PLACEHOLDER_ITEMS = [
  { name: "Product one", price: "kr 249" },
  { name: "Product two", price: "kr 349" },
  { name: "Product three", price: "kr 199" },
];

export function ProductGridRender({ block, edit }: Props) {
  return (
    <div className="pg-productgrid pg-block">
      {block.heading && <h2 className="pg-productgrid__h">{block.heading}</h2>}
      {edit ? (
        <div className="pg-productgrid__grid">
          {PLACEHOLDER_ITEMS.map((p, i) => (
            <div className="pg-productgrid__card" key={i}>
              <div aria-hidden="true" className="pg-productgrid__img" />
              <div className="pg-productgrid__name">{p.name}</div>
              <div className="pg-productgrid__price">{p.price}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="pg-productgrid__notice">
          Products load from the shop on the live page.
        </p>
      )}
    </div>
  );
}
