"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { FilterBarBlock, PageDoc } from "@/editor/types";

interface Props {
  block: FilterBarBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

const TARGETS: { value: FilterBarBlock["target"]; label: string }[] = [
  { value: "news", label: "News feed" },
  { value: "jobs", label: "Jobs feed" },
  { value: "units", label: "Units / departments" },
];

export function FilterBarInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Target">
      <InspRow label="Filters">
        <select
          onChange={(e) => onPatch("target", e.target.value)}
          value={block.target}
        >
          {TARGETS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </InspRow>
      <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "6px 0 0" }}>
        Place this block above the matching feed block. It passes the search
        term via URL so the feed block can filter its results.
      </p>
    </InspSection>
  );
}
