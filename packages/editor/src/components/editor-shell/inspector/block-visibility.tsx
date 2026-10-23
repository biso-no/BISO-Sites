"use client";

import type { PatchFn } from "@/blocks/types";
import type { Block } from "@/editor/types";
import { InspSection } from "./insp-parts";

export function BlockVisibility({
  block,
  onPatch,
}: {
  block: Block;
  onPatch: PatchFn;
}) {
  return (
    <InspSection label="Visibility">
      <label className="pe-check">
        <input
          checked={block.hideOnPhone === true}
          onChange={(e) => onPatch("hideOnPhone", e.target.checked)}
          type="checkbox"
        />
        Hide on phone
      </label>
    </InspSection>
  );
}
