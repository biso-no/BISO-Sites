"use client";

import type { CampusSelectorBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: CampusSelectorBlock; doc: PageDoc; onPatch: PatchFn; }

export function CampusSelectorInspector({ block, onPatch }: Props) {
  const mode = block.mode ?? "cards";
  return (
    <>
      <InspSection label="Mode">
        <div className="pe-variant-grid">
          {(["switcher", "cards"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`pe-variant${mode === v ? " on" : ""}`}
              onClick={() => onPatch("mode", v)}
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input value={block.heading ?? ""} onChange={(e) => onPatch("heading", e.target.value)} placeholder="Choose your campus" />
        </InspRow>
      </InspSection>
    </>
  );
}
