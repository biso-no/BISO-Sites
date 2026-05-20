"use client";

import type { CalloutBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: CalloutBlock; doc: PageDoc; onPatch: PatchFn; }

export function CalloutInspector({ block, onPatch }: Props) {
  const tone = block.tone ?? "info";
  return (
    <>
      <InspSection label="Tone">
        <div className="pe-variant-grid">
          {(["info", "warn", "tip"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`pe-variant${tone === t ? " on" : ""}`}
              onClick={() => onPatch("tone", t)}
            >
              <span className="v-name">{t}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="Callout">
        <InspRow label="Title">
          <input value={block.title} onChange={(e) => onPatch("title", e.target.value)} />
        </InspRow>
        <InspRow label="Body">
          <textarea value={block.body} rows={3} onChange={(e) => onPatch("body", e.target.value)} />
        </InspRow>
      </InspSection>
    </>
  );
}
