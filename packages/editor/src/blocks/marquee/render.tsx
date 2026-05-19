"use client";

import type { MarqueeBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: MarqueeBlock; edit: boolean; onPatch: PatchFn; }

export function MarqueeRender({ block, edit, onPatch }: Props) {
  const parts = (block.text || "").split(/\s*·\s*/);
  const repeated = [...parts, ...parts];
  return (
    <div className="pg-marquee pg-block">
      {edit ? (
        <div style={{ padding: "8px 24px" }}>
          <input
            value={block.text}
            onChange={(e) => onPatch("text", e.target.value)}
            style={{ width: "100%", border: "0.5px solid var(--rule-2)", borderRadius: 6, padding: "6px 10px", background: "var(--paper-2)", font: "inherit", fontSize: 13, color: "var(--ink)" }}
            placeholder="Word · Word · Word"
          />
          <p style={{ fontSize: 11, color: "var(--ink-4)", margin: "4px 0 0" }}>Separate items with · (middot)</p>
        </div>
      ) : (
        <div className="pg-marquee-track">
          {repeated.map((p, i) => <span key={i}>{p}</span>)}
        </div>
      )}
    </div>
  );
}
