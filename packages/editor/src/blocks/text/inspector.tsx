"use client";

import type { TextBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: TextBlock; doc: PageDoc; onPatch: PatchFn; }

export function TextInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Paragraphs">
      <p style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
        Click any text on the canvas to edit inline.
        {" "}
        <span style={{ color: "var(--ink)" }}>{block.body.length} paragraph{block.body.length !== 1 ? "s" : ""}</span>
      </p>
      <button
        type="button"
        className="pe-row"
        style={{ fontSize: 12, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer", marginTop: 6 }}
        onClick={() => {
          onPatch("body", [...block.body, { type: "p", text: "New paragraph." }]);
        }}
      >
        + Add paragraph
      </button>
    </InspSection>
  );
}
