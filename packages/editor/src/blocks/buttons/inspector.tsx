"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { ButtonsBlock, PageDoc } from "@/editor/types";

interface Props {
  block: ButtonsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function ButtonsInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Align">
        <Segmented
          choices={[
            { label: "Start", value: "start" },
            { label: "Center", value: "center" },
          ]}
          onPick={(align) => onPatch("align", align)}
          value={block.align}
        />
      </InspSection>
      <InspSection label="Buttons">
        <ItemList
          addLabel="+ Add button"
          items={block.items}
          max={3}
          newItem={() => ({ href: "", label: "Button", style: "secondary" })}
          onChange={(items) => onPatch("items", items)}
          renderItem={(item, update) => (
            <>
              <InspRow label="Label">
                <input
                  onChange={(e) => update({ ...item, label: e.target.value })}
                  value={item.label}
                />
              </InspRow>
              <InspRow label="Link">
                <input
                  onChange={(e) => update({ ...item, href: e.target.value })}
                  value={item.href}
                />
              </InspRow>
              <InspRow label="Style">
                <Segmented
                  choices={[
                    { label: "Primary", value: "primary" },
                    { label: "Secondary", value: "secondary" },
                  ]}
                  onPick={(style) => update({ ...item, style })}
                  value={item.style}
                />
              </InspRow>
            </>
          )}
          title={(item, i) => item.label || `Button ${i + 1}`}
        />
      </InspSection>
    </>
  );
}
