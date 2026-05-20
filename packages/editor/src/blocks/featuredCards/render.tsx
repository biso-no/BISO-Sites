"use client";

import type { PatchFn } from "@/blocks/types";
import type { FeaturedCardsBlock } from "@/editor/types";

interface Props {
  block: FeaturedCardsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function FeaturedCardsRender({ block, edit }: Props) {
  return (
    <div className="pg-featcards pg-block">
      {block.heading && <h2 className="pg-featcards__h">{block.heading}</h2>}
      <div className="pg-featcards__grid">
        {block.items.map((item, i) => (
          <div className="pg-featcards__card" key={i}>
            <div
              aria-hidden="true"
              className="pg-featcards__stripe"
              style={{ background: item.stripeAccent }}
            />
            <div className="pg-featcards__body">
              {item.eyebrow && (
                <p className="pg-featcards__eyebrow">{item.eyebrow}</p>
              )}
              <h3 className="pg-featcards__title">{item.title}</h3>
              <p className="pg-featcards__text">{item.body}</p>
              {item.href && !edit && (
                <a className="pg-featcards__link" href={item.href}>
                  Read more →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
