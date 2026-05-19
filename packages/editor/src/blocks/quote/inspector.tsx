"use client";

import type { QuoteBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: QuoteBlock; doc: PageDoc; onPatch: PatchFn; }

export function QuoteInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Quote">
      <InspRow label="Quote">
        <input value={block.text} onChange={(e) => onPatch("text", e.target.value)} />
      </InspRow>
      <InspRow label="Author">
        <input value={block.author} onChange={(e) => onPatch("author", e.target.value)} />
      </InspRow>
      <InspRow label="Role">
        <input value={block.role} onChange={(e) => onPatch("role", e.target.value)} />
      </InspRow>
    </InspSection>
  );
}
