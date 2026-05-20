"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { CalloutBlock, PageDoc } from "@/editor/types";

interface Props {
  block: CalloutBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function CalloutInspector({ block, onPatch }: Props) {
  const tone = block.tone ?? "info";
  return (
    <>
      <InspSection label="Tone">
        <div className="pe-variant-grid">
          {(["info", "warn", "tip"] as const).map((t) => (
            <button
              className={`pe-variant${tone === t ? "on" : ""}`}
              key={t}
              onClick={() => onPatch("tone", t)}
              type="button"
            >
              <span className="v-name">{t}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="Callout">
        <InspRow label="Title">
          <input
            onChange={(e) => onPatch("title", e.target.value)}
            value={block.title}
          />
        </InspRow>
        <InspRow label="Body">
          <textarea
            onChange={(e) => onPatch("body", e.target.value)}
            rows={3}
            value={block.body}
          />
        </InspRow>
      </InspSection>
    </>
  );
}
