"use client";

import type { StatsBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: StatsBlock; doc: PageDoc; onPatch: PatchFn; }

export function StatsInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Stats">
      {block.items.map((item, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <InspRow label="Number">
            <input value={item.num} onChange={(e) => {
              const items = block.items.map((x, j) => j === i ? { ...x, num: e.target.value } : x);
              onPatch("items", items);
            }} />
          </InspRow>
          <InspRow label="Label">
            <input value={item.label} onChange={(e) => {
              const items = block.items.map((x, j) => j === i ? { ...x, label: e.target.value } : x);
              onPatch("items", items);
            }} />
          </InspRow>
        </div>
      ))}
    </InspSection>
  );
}
