"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { TwoColBlock } from "@/editor/types";

interface Props {
  block: TwoColBlock;
  onPatch: PatchFn;
}

export function TwoColInspector({ block, onPatch }: Props) {
  const variant = block.variant ?? "equal";
  return (
    <>
      <InspSection label="Layout">
        <div className="pe-variant-grid">
          {(["equal", "leftWide", "rightWide"] as const).map((v) => (
            <button
              className={`pe-variant${variant === v ? "on" : ""}`}
              key={v}
              onClick={() => onPatch("variant", v)}
              type="button"
            >
              <span className="v-name">
                {v === "equal"
                  ? "50 / 50"
                  : v === "leftWide"
                    ? "66 / 33"
                    : "33 / 66"}
              </span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="Two columns">
        <InspRow label="Left">
          <textarea
            onChange={(e) => onPatch("left", e.target.value)}
            placeholder="Left column…"
            rows={3}
            value={block.left}
          />
        </InspRow>
        <InspRow label="Right">
          <textarea
            onChange={(e) => onPatch("right", e.target.value)}
            placeholder="Right column…"
            rows={3}
            value={block.right}
          />
        </InspRow>
      </InspSection>
    </>
  );
}
