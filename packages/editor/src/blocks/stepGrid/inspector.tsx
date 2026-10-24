"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { PageDoc, StepGridBlock, StepGridItem } from "@/editor/types";

interface Props {
  block: StepGridBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function StepGridInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            placeholder="How it works"
            value={typeof block.heading === "string" ? block.heading : ""}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Steps">
        <ItemList<StepGridItem>
          addLabel="+ Add step"
          items={listOf<StepGridItem>(block.items)}
          newItem={() => ({ title: "New step", body: "Description." })}
          onChange={(items) => onPatch("items", items)}
          renderItem={(item, update) => (
            <>
              <InspRow label="Title">
                <input
                  onChange={(e) => update({ ...item, title: e.target.value })}
                  value={item.title ?? ""}
                />
              </InspRow>
              <InspRow label="Body">
                <textarea
                  onChange={(e) => update({ ...item, body: e.target.value })}
                  rows={2}
                  value={item.body ?? ""}
                />
              </InspRow>
            </>
          )}
          title={(_, i) => `Step ${i + 1}`}
        />
      </InspSection>
    </>
  );
}
