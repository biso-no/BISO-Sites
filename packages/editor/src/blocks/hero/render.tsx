"use client";

import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { HeroBlock } from "@/editor/types";

interface Props {
  block: HeroBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function HeroRender({ block, edit, onPatch }: Props) {
  const variant = block.variant ?? "split";

  const content = (
    <div className="pg-hero__content">
      <EditableText
        className="pg-hero__eyebrow"
        edit={edit}
        onChange={(v) => onPatch("eyebrow", v)}
        tag="p"
        value={block.eyebrow}
      />
      <EditableText
        className="pg-hero__h1"
        edit={edit}
        onChange={(v) => onPatch("title", v)}
        tag="h1"
        value={block.title}
      />
      <EditableText
        className="pg-hero__sub"
        edit={edit}
        onChange={(v) => onPatch("subtitle", v)}
        tag="p"
        value={block.subtitle}
      />
      {edit ? (
        <button className="pg-hero__cta" type="button">
          {block.ctaLabel}
        </button>
      ) : (
        <a className="pg-hero__cta" href={block.ctaUrl}>
          {block.ctaLabel}
        </a>
      )}
    </div>
  );

  const art = (
    <div aria-hidden="true" className="pg-hero-art">
      <svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            height="40"
            id="hg"
            patternTransform="rotate(30)"
            patternUnits="userSpaceOnUse"
            width="40"
          >
            <line
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
              x1="0"
              x2="40"
              y1="0"
              y2="40"
            />
          </pattern>
        </defs>
        <rect fill="url(#hg)" height="500" width="400" />
      </svg>
      <div
        className="pg-hero-art__crest"
        style={{ fontFamily: "var(--serif)" }}
      >
        {block.eyebrow.slice(0, 1)}
      </div>
      {block.imageAlt && (
        <div className="pg-hero-art__photo-tag">{block.imageAlt}</div>
      )}
    </div>
  );

  return (
    <section className={`pg-hero pg-hero--${variant} pg-block`}>
      {content}
      {variant === "split" && art}
    </section>
  );
}
