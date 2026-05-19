"use client";

import type { MarqueeBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: MarqueeBlock; onPatch: PatchFn; }

export function MarqueeInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Marquee">
      <InspRow label="Text">
        <input
          value={block.text}
          onChange={(e) => onPatch("text", e.target.value)}
          placeholder="Word · Word · Word"
        />
      </InspRow>
    </InspSection>
  );
}
