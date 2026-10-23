"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { FactItem, FactsBlock, PageDoc } from "@/editor/types";

interface Props {
  block: FactsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function FactsInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Facts">
      <ItemList<FactItem>
        addLabel="+ Add fact"
        items={block.items}
        newItem={() => ({ label: "Label", text: "Value" })}
        onChange={(items) => onPatch("items", items)}
        renderItem={(item, update) => (
          <>
            <InspRow label="Label">
              <input
                onChange={(e) => update({ ...item, label: e.target.value })}
                value={item.label}
              />
            </InspRow>
            <InspRow label="Text">
              <input
                onChange={(e) => update({ ...item, text: e.target.value })}
                value={item.text}
              />
            </InspRow>
            <InspRow label="Link">
              <input
                onChange={(e) =>
                  update({ ...item, href: e.target.value || undefined })
                }
                placeholder="https://"
                value={item.href ?? ""}
              />
            </InspRow>
          </>
        )}
        title={(item, i) => item.label || `Fact ${i + 1}`}
      />
    </InspSection>
  );
}
