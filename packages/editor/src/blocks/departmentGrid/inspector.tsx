"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { DepartmentGridBlock, PageDoc } from "@/editor/types";

interface Props {
  block: DepartmentGridBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function DepartmentGridInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Layout">
        <div className="pe-variant-grid">
          {(["grid", "list"] as const).map((v) => (
            <button
              className={`pe-variant${(block.layout ?? "grid") === v ? "on" : ""}`}
              key={v}
              onClick={() => onPatch("layout", v)}
              type="button"
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="Settings">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            placeholder="Departments"
            value={block.heading ?? ""}
          />
        </InspRow>
        <InspRow label="Show filters">
          <input
            checked={block.showFilters}
            onChange={(e) => onPatch("showFilters", e.target.checked)}
            type="checkbox"
          />
        </InspRow>
      </InspSection>
      <p
        style={{
          fontSize: 11,
          color: "var(--leaf)",
          padding: "0 14px 12px",
          lineHeight: 1.45,
        }}
      >
        ● Live — fetching departments from Appwrite
      </p>
    </>
  );
}
