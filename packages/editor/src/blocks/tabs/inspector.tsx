"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { PageDoc, TabItem, TabsBlock } from "@/editor/types";

interface Props {
  block: TabsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function TabsInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Tabs">
      <ItemList
        addLabel="+ Add tab"
        items={listOf<TabItem>(block.tabs)}
        newItem={() => ({ body: "Tab content.", label: "New tab" })}
        onChange={(tabs) => onPatch("tabs", tabs)}
        renderItem={(tab, update) => (
          <>
            <InspRow label="Label">
              <input
                onChange={(e) => update({ ...tab, label: e.target.value })}
                value={tab.label ?? ""}
              />
            </InspRow>
            <InspRow label="Content">
              <textarea
                onChange={(e) => update({ ...tab, body: e.target.value })}
                rows={3}
                value={tab.body ?? ""}
              />
            </InspRow>
          </>
        )}
        title={(tab, i) =>
          (typeof tab.label === "string" && tab.label) || `Tab ${i + 1}`
        }
      />
    </InspSection>
  );
}
