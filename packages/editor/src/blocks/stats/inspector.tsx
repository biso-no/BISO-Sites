"use client";

import type { StatsBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: StatsBlock; doc: PageDoc; onPatch: PatchFn; }

export function StatsInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Stats">
      {block.items.map((item, i) => (
        <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "0.5px solid var(--rule)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Stat {i + 1}</span>
            <button
              type="button"
              onClick={() => onPatch("items", block.items.filter((_, j) => j !== i))}
              style={{ width: 18, height: 18, borderRadius: "50%", border: 0, background: "var(--rule-2)", cursor: "pointer", fontSize: 9, display: "grid", placeItems: "center" }}
              aria-label="Remove stat"
            >✕</button>
          </div>
          <InspRow label="Number">
            <input value={item.num} onChange={(e) => {
              onPatch("items", block.items.map((x, j) => j === i ? { ...x, num: e.target.value } : x));
            }} />
          </InspRow>
          <InspRow label="Label">
            <input value={item.label} onChange={(e) => {
              onPatch("items", block.items.map((x, j) => j === i ? { ...x, label: e.target.value } : x));
            }} />
          </InspRow>
        </div>
      ))}
      <button
        type="button"
        style={{ fontSize: 12, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer" }}
        onClick={() => onPatch("items", [...block.items, { num: "0", label: "New stat" }])}
      >
        + Add stat
      </button>
    </InspSection>
  );
}
