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
          value={typeof block.text === "string" ? block.text : ""}
        />
      </InspRow>
      <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 6 }}>
        Separate items with · (middot). The strip scrolls on the site and stays
        still for visitors who prefer reduced motion.
      </p>
    </InspSection>
  );
}
