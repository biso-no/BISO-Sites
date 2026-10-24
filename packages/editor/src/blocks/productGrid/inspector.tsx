"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { SourcePicker } from "@/components/editor-shell/inspector/source-picker";
import { shopBlockLimit } from "@/editor/page-feeds";
import type { PageDoc, ProductGridBlock } from "@/editor/types";

interface Props {
  block: ProductGridBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

const LIMITS = [
  { label: "4", value: "4" },
  { label: "8", value: "8" },
] as const;

export function ProductGridInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Shop">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading ?? ""}
          />
        </InspRow>
        <InspRow label="Show">
          <Segmented
            choices={[...LIMITS]}
            onPick={(v) => onPatch("limit", v === "8" ? 8 : 4)}
            value={String(shopBlockLimit(block.limit)) as "4" | "8"}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Data source">
        <InspRow label="Department">
          <SourcePicker
            onChange={(v) => onPatch("source", v)}
            value={block.source ?? "auto"}
          />
        </InspRow>
      </InspSection>
    </>
  );
}
