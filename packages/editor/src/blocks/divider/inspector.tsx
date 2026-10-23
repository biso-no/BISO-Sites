"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import type { DividerBlock, PageDoc } from "@/editor/types";

interface Props {
  block: DividerBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function DividerInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Divider">
      <InspRow label="Spacing">
        <Segmented
          choices={[
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ]}
          onPick={(v) => onPatch("spacing", v)}
          value={block.spacing}
        />
      </InspRow>
    </InspSection>
  );
}
