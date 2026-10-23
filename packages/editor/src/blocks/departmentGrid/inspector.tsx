"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import {
  UNIT_CATEGORY_IDS,
  unitsBlockLimit,
  unitsFeedCategory,
  unitsScope,
} from "@/editor/page-feeds";
import type { DepartmentGridBlock, PageDoc } from "@/editor/types";

interface Props {
  block: DepartmentGridBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

const SCOPES = [
  { label: "This campus", value: "campus" },
  { label: "All campuses", value: "all" },
] as const;

const LIMITS = ["3", "6", "9", "12"] as const;

const CATEGORY_LABELS: Record<(typeof UNIT_CATEGORY_IDS)[number], string> = {
  academic_association: "Academic associations",
  national: "National",
  other: "Other",
  project: "Projects",
  society: "Societies",
  staff_function: "Staff functions",
};

export function DepartmentGridInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Units">
      <InspRow label="Heading">
        <input
          onChange={(e) => onPatch("heading", e.target.value)}
          value={block.heading ?? ""}
        />
      </InspRow>
      <InspRow label="Show">
        <Segmented
          choices={LIMITS.map((v) => ({ label: v, value: v }))}
          onPick={(v) => onPatch("limit", Number(v))}
          value={
            String(unitsBlockLimit(block.limit)) as (typeof LIMITS)[number]
          }
        />
      </InspRow>
      <InspRow label="Campus">
        <Segmented
          choices={[...SCOPES]}
          onPick={(v) => onPatch("scope", v)}
          value={unitsScope(block.scope)}
        />
      </InspRow>
      {unitsScope(block.scope) === "campus" ? (
        <p className="pe-insp-note">
          On national pages this shows units from every campus.
        </p>
      ) : null}
      <InspRow label="Category">
        <select
          onChange={(e) => onPatch("category", e.target.value)}
          value={unitsFeedCategory(block.category)}
        >
          <option value="">All categories</option>
          {UNIT_CATEGORY_IDS.map((id) => (
            <option key={id} value={id}>
              {CATEGORY_LABELS[id]}
            </option>
          ))}
        </select>
      </InspRow>
    </InspSection>
  );
}
