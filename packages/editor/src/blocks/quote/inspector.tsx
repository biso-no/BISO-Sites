"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { PageDoc, QuoteBlock } from "@/editor/types";

interface Props {
  block: QuoteBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function QuoteInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Quote">
      <InspRow label="Quote">
        <input
          onChange={(e) => onPatch("text", e.target.value)}
          value={block.text}
        />
      </InspRow>
      <InspRow label="Author">
        <input
          onChange={(e) => onPatch("author", e.target.value)}
          value={block.author}
        />
      </InspRow>
      <InspRow label="Role">
        <input
          onChange={(e) => onPatch("role", e.target.value)}
          value={block.role}
        />
      </InspRow>
    </InspSection>
  );
}
