"use client";

import type { HeroBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";

interface Props {
  block: HeroBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function HeroRender({ block, edit, onPatch }: Props) {
  return (
    <section className="pg-hero pg-block">
      <div>
        <EditableText
          className="pg-hero__eyebrow"
          tag="p"
          value={block.eyebrow}
          edit={edit}
          onChange={(v) => onPatch("eyebrow", v)}
        />
        <EditableText
          className="pg-hero__h1"
          tag="h1"
          value={block.title}
          edit={edit}
          onChange={(v) => onPatch("title", v)}
        />
        <EditableText
          className="pg-hero__sub"
          tag="p"
          value={block.subtitle}
          edit={edit}
          onChange={(v) => onPatch("subtitle", v)}
        />
        {edit ? (
          <button className="pg-hero__cta" type="button">{block.ctaLabel}</button>
        ) : (
          <a className="pg-hero__cta" href={block.ctaUrl}>{block.ctaLabel}</a>
        )}
      </div>
      <div className="pg-hero-art" aria-hidden="true">
        <svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hg" patternUnits="userSpaceOnUse" width="40" height="40" patternTransform="rotate(30)">
              <line x1="0" y1="0" x2="40" y2="40" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="400" height="500" fill="url(#hg)"/>
        </svg>
        <div className="pg-hero-art__crest" style={{ fontFamily: "var(--serif)" }}>
          {block.eyebrow.slice(0, 1)}
        </div>
        {block.imageAlt && (
          <div className="pg-hero-art__photo-tag">{block.imageAlt}</div>
        )}
      </div>
    </section>
  );
}
