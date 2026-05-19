"use client";

import type { CtaBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: CtaBlock; doc: PageDoc; onPatch: PatchFn; }

export function CtaInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="CTA">
      <InspRow label="Title">
        <input value={block.title} onChange={(e) => onPatch("title", e.target.value)} />
      </InspRow>
      <InspRow label="Label">
        <input value={block.label} onChange={(e) => onPatch("label", e.target.value)} />
      </InspRow>
      <InspRow label="URL">
        <input type="url" value={block.url} onChange={(e) => onPatch("url", e.target.value)} />
      </InspRow>
    </InspSection>
  );
}
