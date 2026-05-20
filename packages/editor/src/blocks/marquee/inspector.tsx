"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { MarqueeBlock } from "@/editor/types";

interface Props {
  block: MarqueeBlock;
  onPatch: PatchFn;
}

export function MarqueeInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Marquee">
      <InspRow label="Text">
        <input
          onChange={(e) => onPatch("text", e.target.value)}
          placeholder="Word · Word · Word"
          value={block.text}
        />
      </InspRow>
    </InspSection>
  );
}
