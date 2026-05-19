"use client";

import type { TeamBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: TeamBlock; doc: PageDoc; onPatch: PatchFn; }

export function TeamInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Team">
      <InspRow label="Heading">
        <input value={block.heading} onChange={(e) => onPatch("heading", e.target.value)} />
      </InspRow>
      <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 8 }}>
        {block.members.length} member{block.members.length !== 1 ? "s" : ""}. Click names and roles on canvas to edit inline.
      </p>
      <button
        type="button"
        style={{ fontSize: 12, marginTop: 6, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer" }}
        onClick={() => {
          onPatch("members", [...block.members, { name: "New Member", role: "Role", initials: "NM", hue: "claret" }]);
        }}
      >
        + Add member
      </button>
    </InspSection>
  );
}
