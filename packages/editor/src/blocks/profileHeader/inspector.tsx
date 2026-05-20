"use client";

import type { ProfileHeaderBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: ProfileHeaderBlock; doc: PageDoc; onPatch: PatchFn; }

export function ProfileHeaderInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input
            value={block.heading ?? ""}
            onChange={(e) => onPatch("heading", e.target.value || undefined)}
            placeholder="My BISO"
          />
        </InspRow>
      </InspSection>
      <InspSection label="Display">
        <InspRow label="Show avatar">
          <input
            type="checkbox"
            checked={block.showAvatar}
            onChange={(e) => onPatch("showAvatar", e.target.checked)}
          />
        </InspRow>
        <InspRow label="Show stats">
          <input
            type="checkbox"
            checked={block.showStats}
            onChange={(e) => onPatch("showStats", e.target.checked)}
          />
        </InspRow>
      </InspSection>
      <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "8px 12px" }}>
        This block requires the user to be signed in. It renders nothing for unauthenticated visitors.
      </p>
    </>
  );
}
