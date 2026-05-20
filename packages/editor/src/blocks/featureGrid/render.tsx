"use client";

import type { PatchFn } from "@/blocks/types";
import type { FeatureGridBlock } from "@/editor/types";

interface Props {
  block: FeatureGridBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function FeatureGridRender({ block, edit }: Props) {
  const cols = block.columns ?? 3;
  const variant = block.variant ?? "cards";
  return (
    <div className={`pg-featuregrid pg-featuregrid--${variant} pg-block`}>
      {block.heading && <h2 className="pg-featuregrid__h">{block.heading}</h2>}
      {block.intro && <p className="pg-featuregrid__intro">{block.intro}</p>}
      <div
        className="pg-featuregrid__grid"
        style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}
      >
        {block.items.map((item, i) => (
          <div className="pg-featuregrid__card" key={i}>
            <div aria-hidden="true" className="pg-featuregrid__icon">
              {item.icon}
            </div>
            <div className="pg-featuregrid__title">{item.title}</div>
            <div className="pg-featuregrid__body">{item.body}</div>
            {item.href && !edit ? (
              <a className="pg-featuregrid__link" href={item.href}>
                Learn more →
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
