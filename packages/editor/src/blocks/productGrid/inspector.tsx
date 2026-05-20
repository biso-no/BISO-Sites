"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { PageDoc, ProductGridBlock } from "@/editor/types";

interface Props {
  block: ProductGridBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function ProductGridInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value || undefined)}
            placeholder="Shop"
            value={block.heading ?? ""}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Filter">
        <InspRow label="Tag">
          <input
            onChange={(e) => onPatch("tag", e.target.value || undefined)}
            placeholder="e.g. featured, sale"
            value={block.tag ?? ""}
          />
        </InspRow>
        <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "6px 0 0" }}>
          Leave blank to show all products. Products are fetched live from the
          shop on publish.
        </p>
      </InspSection>
    </>
  );
}
