"use client";

import type { DepartmentGridBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: DepartmentGridBlock; doc: PageDoc; onPatch: PatchFn; }

export function DepartmentGridInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Layout">
        <div className="pe-variant-grid">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`pe-variant${(block.layout ?? "grid") === v ? " on" : ""}`}
              onClick={() => onPatch("layout", v)}
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="Settings">
        <InspRow label="Heading">
          <input value={block.heading ?? ""} onChange={(e) => onPatch("heading", e.target.value)} placeholder="Departments" />
        </InspRow>
        <InspRow label="Show filters">
          <input
            type="checkbox"
            checked={block.showFilters}
            onChange={(e) => onPatch("showFilters", e.target.checked)}
          />
        </InspRow>
      </InspSection>
      <p style={{ fontSize: 11, color: "var(--leaf)", padding: "0 14px 12px", lineHeight: 1.45 }}>
        ● Live — fetching departments from Appwrite
      </p>
    </>
  );
}
