"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { FaqBlock, FaqItem, PageDoc } from "@/editor/types";

interface Props {
  block: FaqBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function FaqInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="FAQ">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={typeof block.heading === "string" ? block.heading : ""}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Questions">
        <ItemList
          addLabel="+ Add question"
          items={listOf<FaqItem>(block.items)}
          newItem={() => ({ a: "Answer.", q: "New question?" })}
          onChange={(items) => onPatch("items", items)}
          renderItem={(item, update) => (
            <>
              <InspRow label="Question">
                <input
                  onChange={(e) => update({ ...item, q: e.target.value })}
                  value={item.q ?? ""}
                />
              </InspRow>
              <InspRow label="Answer">
                <textarea
                  onChange={(e) => update({ ...item, a: e.target.value })}
                  rows={3}
                  value={item.a ?? ""}
                />
              </InspRow>
            </>
          )}
          title={(_, i) => `Question ${i + 1}`}
        />
      </InspSection>
    </>
  );
}
