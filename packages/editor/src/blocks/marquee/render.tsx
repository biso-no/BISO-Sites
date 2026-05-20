"use client";

import type { PatchFn } from "@/blocks/types";
import type { MarqueeBlock } from "@/editor/types";

interface Props {
  block: MarqueeBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const MARQUEE_SEPARATOR_RE = /\s*·\s*/;

export function MarqueeRender({ block, edit, onPatch }: Props) {
  const parts = (block.text || "").split(MARQUEE_SEPARATOR_RE);
  const repeated = [...parts, ...parts];
  return (
    <div className="pg-marquee pg-block">
      {edit ? (
        <div style={{ padding: "8px 24px" }}>
          <input
            onChange={(e) => onPatch("text", e.target.value)}
            placeholder="Word · Word · Word"
            style={{
              width: "100%",
              border: "0.5px solid var(--rule-2)",
              borderRadius: 6,
              padding: "6px 10px",
              background: "var(--paper-2)",
              font: "inherit",
              fontSize: 13,
              color: "var(--ink)",
            }}
            value={block.text}
          />
          <p style={{ fontSize: 11, color: "var(--ink-4)", margin: "4px 0 0" }}>
            Separate items with · (middot)
          </p>
        </div>
      ) : (
        <div className="pg-marquee-track">
          {repeated.map((p, i) => (
            <span key={i}>{p}</span>
          ))}
        </div>
      )}
    </div>
  );
}
