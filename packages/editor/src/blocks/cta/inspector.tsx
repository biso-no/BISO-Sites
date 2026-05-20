"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { CtaBlock, PageDoc } from "@/editor/types";

interface Props {
  block: CtaBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function CtaInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Style">
        <div className="pe-variant-grid">
          {(["card", "banner", "gradient"] as const).map((v) => (
            <button
              className={`pe-variant${(block.variant ?? "card") === v ? "on" : ""}`}
              key={v}
              onClick={() => onPatch("variant", v)}
              type="button"
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="CTA">
        <InspRow label="Title">
          <input
            onChange={(e) => onPatch("title", e.target.value)}
            value={block.title}
          />
        </InspRow>
        <InspRow label="Label">
          <input
            onChange={(e) => onPatch("label", e.target.value)}
            value={block.label}
          />
        </InspRow>
        <InspRow label="URL">
          <input
            onChange={(e) => onPatch("url", e.target.value)}
            type="url"
            value={block.url}
          />
        </InspRow>
      </InspSection>
    </>
  );
}
