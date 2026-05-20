"use client";

import type { StepGridBlock, StepGridItem, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: StepGridBlock; doc: PageDoc; onPatch: PatchFn; }

export function StepGridInspector({ block, onPatch }: Props) {
  function patchItem(i: number, patch: Partial<StepGridItem>) {
    onPatch("items", block.items.map((x, j) => j === i ? { ...x, ...patch } : x));
  }
  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input value={block.heading ?? ""} onChange={(e) => onPatch("heading", e.target.value)} placeholder="How it works" />
        </InspRow>
      </InspSection>
      <InspSection label={`Steps (${block.items.length})`}>
        {block.items.map((item, i) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: "0.5px solid var(--rule)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 500 }}>Step {item.number}</span>
              <button
                type="button"
                onClick={() => onPatch("items", block.items.filter((_, j) => j !== i))}
                style={{ width: 18, height: 18, borderRadius: "50%", border: 0, background: "var(--rule-2)", cursor: "pointer", fontSize: 9, display: "grid", placeItems: "center" }}
                aria-label="Remove"
              >✕</button>
            </div>
            <InspRow label="Number"><input value={item.number} onChange={(e) => patchItem(i, { number: e.target.value })} placeholder="01" /></InspRow>
            <InspRow label="Title"><input value={item.title} onChange={(e) => patchItem(i, { title: e.target.value })} /></InspRow>
            <InspRow label="Body"><textarea value={item.body} rows={2} onChange={(e) => patchItem(i, { body: e.target.value })} /></InspRow>
          </div>
        ))}
        <button
          type="button"
          style={{ fontSize: 12, marginTop: 8, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer" }}
          onClick={() => {
            const n = String(block.items.length + 1).padStart(2, "0");
            onPatch("items", [...block.items, { number: n, title: "New step", body: "Description." }]);
          }}
        >+ Add step</button>
      </InspSection>
    </>
  );
}
