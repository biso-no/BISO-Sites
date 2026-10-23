"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { PageDoc, StatsBlock } from "@/editor/types";

interface Props {
  block: StatsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function StatsInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Stats">
      <ItemList
        addLabel="+ Add stat"
        items={block.items}
        newItem={() => ({ num: "0", label: "New stat" })}
        onChange={(items) => onPatch("items", items)}
        renderItem={(item, update) => (
          <>
            <InspRow label="Number">
              <input
                onChange={(e) => update({ ...item, num: e.target.value })}
                value={item.num}
              />
            </InspRow>
            <InspRow label="Label">
              <input
                onChange={(e) => update({ ...item, label: e.target.value })}
                value={item.label}
              />
            </InspRow>
          </>
        )}
        title={(_, i) => `Stat ${i + 1}`}
      />
    </InspSection>
  );
}
