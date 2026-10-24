"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { PageDoc, TimelineBlock, TimelineItem } from "@/editor/types";

interface Props {
  block: TimelineBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function TimelineInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Timeline">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={typeof block.heading === "string" ? block.heading : ""}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Entries">
        <ItemList<TimelineItem>
          addLabel="+ Add entry"
          items={listOf<TimelineItem>(block.items)}
          newItem={() => ({ label: "Dag 1 · 10:00", text: "What happens." })}
          onChange={(items) => onPatch("items", items)}
          renderItem={(item, update) => (
            <>
              <InspRow label="Label">
                <input
                  onChange={(e) => update({ ...item, label: e.target.value })}
                  placeholder="Dag 1 · 10:00"
                  value={item.label ?? ""}
                />
              </InspRow>
              <InspRow label="Title">
                <input
                  onChange={(e) =>
                    update({ ...item, title: e.target.value || undefined })
                  }
                  value={item.title ?? ""}
                />
              </InspRow>
              <InspRow label="Text">
                <textarea
                  onChange={(e) => update({ ...item, text: e.target.value })}
                  rows={2}
                  value={item.text ?? ""}
                />
              </InspRow>
            </>
          )}
          title={(item) => item.label || "Entry"}
        />
      </InspSection>
    </>
  );
}
