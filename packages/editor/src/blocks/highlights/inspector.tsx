"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { HighlightsBlock, PageDoc } from "@/editor/types";

interface Props {
  block: HighlightsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function HighlightsInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Highlights">
      <ItemList
        addLabel="+ Add highlight"
        items={listOf<HighlightsBlock["items"][number]>(block.items)}
        newItem={() => ({ text: "New highlight" })}
        onChange={(items) => onPatch("items", items)}
        renderItem={(item, update) => (
          <InspRow label="Text">
            <input
              onChange={(e) => update({ text: e.target.value })}
              value={item.text}
            />
          </InspRow>
        )}
        title={(_, i) => `Highlight ${i + 1}`}
      />
    </InspSection>
  );
}
