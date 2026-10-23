"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import type { CtaBandBlock, PageDoc } from "@/editor/types";

interface Props {
  block: CtaBandBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function CtaBandInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Call to action">
        <InspRow label="Eyebrow">
          <input
            onChange={(e) => onPatch("eyebrow", e.target.value)}
            value={block.eyebrow}
          />
        </InspRow>
        <InspRow label="Title">
          <input
            onChange={(e) => onPatch("title", e.target.value)}
            value={block.title}
          />
        </InspRow>
        <InspRow label="Text">
          <textarea
            onChange={(e) => onPatch("text", e.target.value)}
            rows={3}
            value={block.text}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Buttons">
        <ItemList
          addLabel="+ Add button"
          items={block.buttons}
          max={2}
          newItem={() => ({ href: "", label: "Button", style: "secondary" })}
          onChange={(buttons) => onPatch("buttons", buttons)}
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
