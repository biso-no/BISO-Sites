"use client";

import type { FeaturedCardsBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: FeaturedCardsBlock; edit: boolean; onPatch: PatchFn; }

export function FeaturedCardsRender({ block, edit }: Props) {
  return (
    <div className="pg-featcards pg-block">
      {block.heading && <h2 className="pg-featcards__h">{block.heading}</h2>}
      <div className="pg-featcards__grid">
        {block.items.map((item, i) => (
          <div key={i} className="pg-featcards__card">
            <div className="pg-featcards__stripe" style={{ background: item.stripeAccent }} aria-hidden="true"/>
            <div className="pg-featcards__body">
              {item.eyebrow && <p className="pg-featcards__eyebrow">{item.eyebrow}</p>}
              <h3 className="pg-featcards__title">{item.title}</h3>
              <p className="pg-featcards__text">{item.body}</p>
              {item.href && !edit && <a className="pg-featcards__link" href={item.href}>Read more →</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
