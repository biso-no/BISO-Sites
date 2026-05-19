"use client";

import type { TimelineBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";
interface Props { block: TimelineBlock; onPatch: PatchFn; }

export function TimelineInspector({ block, onPatch }: Props) {

  function addItem() {
    const items = [...(block.items || []), { year: "20xx", text: "New milestone" }];
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
          <input value={block.heading} onChange={(e) => onPatch("heading", e.target.value)} />
        </InspRow>
      </InspSection>
      <InspSection label="Items">
        {block.items.map((it, i) => (
          <div key={i} style={{ borderBottom: "0.5px solid var(--rule)", paddingBottom: 10, marginBottom: 10 }}>
            <InspRow label="Year">
              <input value={it.year} onChange={(e) => onPatch(`items.${i}.year`, e.target.value)} />
            </InspRow>
            <InspRow label="Text">
              <input value={it.text} onChange={(e) => onPatch(`items.${i}.text`, e.target.value)} />
            </InspRow>
            <button
              type="button"
              onClick={() => removeItem(i)}
              style={{ fontSize: 11, color: "var(--claret)", cursor: "pointer", background: "none", border: "none", padding: "2px 0" }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          style={{ fontSize: 12, color: "var(--ink-2)", cursor: "pointer", background: "none", border: "0.5px solid var(--rule-2)", borderRadius: 6, padding: "5px 10px", width: "100%", marginTop: 4 }}
        >
          + Add milestone
        </button>
      </InspSection>
    </>
  );
}
