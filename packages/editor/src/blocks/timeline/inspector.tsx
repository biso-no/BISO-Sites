"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { TimelineBlock } from "@/editor/types";

interface Props {
  block: TimelineBlock;
  onPatch: PatchFn;
}

export function TimelineInspector({ block, onPatch }: Props) {
  function addItem() {
    const items = [
      ...(block.items || []),
      { year: "20xx", text: "New milestone" },
    ];
    onPatch("items", items);
  }

  function removeItem(i: number) {
    const items = block.items.filter((_, idx) => idx !== i);
    onPatch("items", items);
  }

  return (
    <>
      <InspSection label="Timeline">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Items">
        {block.items.map((it, i) => (
          <div
            key={i}
            style={{
              borderBottom: "0.5px solid var(--rule)",
              paddingBottom: 10,
              marginBottom: 10,
            }}
          >
            <InspRow label="Year">
              <input
                onChange={(e) => onPatch(`items.${i}.year`, e.target.value)}
                value={it.year}
              />
            </InspRow>
            <InspRow label="Text">
              <input
                onChange={(e) => onPatch(`items.${i}.text`, e.target.value)}
                value={it.text}
              />
            </InspRow>
            <button
              onClick={() => removeItem(i)}
              style={{
                fontSize: 11,
                color: "var(--claret)",
                cursor: "pointer",
                background: "none",
                border: "none",
                padding: "2px 0",
              }}
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={addItem}
          style={{
            fontSize: 12,
            color: "var(--ink-2)",
            cursor: "pointer",
            background: "none",
            border: "0.5px solid var(--rule-2)",
            borderRadius: 6,
            padding: "5px 10px",
            width: "100%",
            marginTop: 4,
          }}
          type="button"
        >
          + Add milestone
        </button>
      </InspSection>
    </>
  );
}
