"use client";

import type { TwoColBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: TwoColBlock; onPatch: PatchFn; }

export function TwoColInspector({ block, onPatch }: Props) {
  const variant = block.variant ?? "equal";
  return (
    <>
      <InspSection label="Layout">
        <div className="pe-variant-grid">
          {(["equal", "leftWide", "rightWide"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`pe-variant${variant === v ? " on" : ""}`}
              onClick={() => onPatch("variant", v)}
            >
              <span className="v-name">{v === "equal" ? "50 / 50" : v === "leftWide" ? "66 / 33" : "33 / 66"}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="Two columns">
        <InspRow label="Left">
          <textarea value={block.left} onChange={(e) => onPatch("left", e.target.value)} rows={3} placeholder="Left column…" />
        </InspRow>
        <InspRow label="Right">
          <textarea value={block.right} onChange={(e) => onPatch("right", e.target.value)} rows={3} placeholder="Right column…" />
        </InspRow>
      </InspSection>
    </>
  );
}
