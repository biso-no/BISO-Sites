"use client";

import type { TwoColBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: TwoColBlock; onPatch: PatchFn; }

export function TwoColInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Two columns">
      <InspRow label="Left">
        <textarea
          value={block.left}
          onChange={(e) => onPatch("left", e.target.value)}
          rows={3}
          placeholder="Left column…"
        />
      </InspRow>
      <InspRow label="Right">
        <textarea
          value={block.right}
          onChange={(e) => onPatch("right", e.target.value)}
          rows={3}
          placeholder="Right column…"
        />
      </InspRow>
    </InspSection>
  );
}
