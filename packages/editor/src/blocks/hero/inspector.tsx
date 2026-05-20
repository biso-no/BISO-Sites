"use client";

import type { HeroBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: HeroBlock; doc: PageDoc; onPatch: PatchFn; }

export function HeroInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Layout">
        <div className="pe-variant-grid">
          {(["split", "centered", "full"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`pe-variant${block.variant === v ? " on" : ""}`}
              onClick={() => onPatch("variant", v)}
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
      </InspSection>

      <InspSection label="Content">
        <InspRow label="Eyebrow">
          <input value={block.eyebrow} onChange={(e) => onPatch("eyebrow", e.target.value)} />
        </InspRow>
        <InspRow label="Title">
          <input value={block.title} onChange={(e) => onPatch("title", e.target.value)} />
        </InspRow>
        <InspRow label="Subtitle">
          <input value={block.subtitle} onChange={(e) => onPatch("subtitle", e.target.value)} />
        </InspRow>
      </InspSection>

      <InspSection label="CTA">
        <InspRow label="Label">
          <input value={block.ctaLabel} onChange={(e) => onPatch("ctaLabel", e.target.value)} />
        </InspRow>
        <InspRow label="URL">
          <input type="url" value={block.ctaUrl} onChange={(e) => onPatch("ctaUrl", e.target.value)} />
        </InspRow>
      </InspSection>

      <InspSection label="Art panel">
        <InspRow label="Image caption">
          <input
            value={block.imageAlt ?? ""}
            onChange={(e) => onPatch("imageAlt", e.target.value)}
            placeholder="Photo credit or label"
          />
        </InspRow>
      </InspSection>
    </>
  );
}
