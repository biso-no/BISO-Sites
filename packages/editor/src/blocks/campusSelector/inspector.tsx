"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { CampusSelectorBlock, PageDoc } from "@/editor/types";

interface Props {
  block: CampusSelectorBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function CampusSelectorInspector({ block, onPatch }: Props) {
  const mode = block.mode ?? "cards";
  return (
    <>
      <InspSection label="Mode">
        <div className="pe-variant-grid">
          {(["switcher", "cards"] as const).map((v) => (
            <button
              className={`pe-variant${mode === v ? "on" : ""}`}
              key={v}
              onClick={() => onPatch("mode", v)}
              type="button"
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            placeholder="Choose your campus"
            value={block.heading ?? ""}
          />
        </InspRow>
      </InspSection>
    </>
  );
}
