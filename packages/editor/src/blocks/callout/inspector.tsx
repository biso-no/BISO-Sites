"use client";

import type { CalloutBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: CalloutBlock; doc: PageDoc; onPatch: PatchFn; }

export function CalloutInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Callout">
      <InspRow label="Title">
        <input value={block.title} onChange={(e) => onPatch("title", e.target.value)} />
      </InspRow>
      <InspRow label="Body">
        <input value={block.body} onChange={(e) => onPatch("body", e.target.value)} />
      </InspRow>
    </InspSection>
  );
}
