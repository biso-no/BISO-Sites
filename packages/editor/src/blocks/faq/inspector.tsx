"use client";

import type { FaqBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: FaqBlock; doc: PageDoc; onPatch: PatchFn; }

export function FaqInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="FAQ">
      <InspRow label="Heading">
        <input value={block.heading} onChange={(e) => onPatch("heading", e.target.value)} />
      </InspRow>
      <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 6 }}>
        {block.items.length} question{block.items.length !== 1 ? "s" : ""}. Edit inline on canvas.
      </p>
      <button
        type="button"
        style={{ fontSize: 12, marginTop: 6, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer" }}
        onClick={() => onPatch("items", [...block.items, { q: "New question?", a: "Answer." }])}
      >
        + Add question
      </button>
    </InspSection>
  );
}
