"use client";

import { knownKey } from "@/blocks/_v2/known-key";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import type { DividerBlock, PageDoc } from "@/editor/types";
import { MARGIN } from "./render";

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
          value={knownKey(MARGIN, block.spacing, "medium")}
        />
      </InspRow>
    </InspSection>
  );
}
