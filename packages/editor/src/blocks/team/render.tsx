"use client";

import type { TeamBlock, TeamMember } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

const HUE_BG: Record<TeamMember["hue"], string> = {
  claret: "linear-gradient(135deg,#6b1e1e,#a03030)",
  gold:   "linear-gradient(135deg,#b08a3e,#d4ad5b)",
  leaf:   "linear-gradient(135deg,#2f5d3a,#4a8a5c)",
  sky:    "linear-gradient(135deg,#2a4a7a,#3d6baa)",
};

interface Props { block: TeamBlock; edit: boolean; onPatch: PatchFn; }

export function TeamRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-team pg-block">
      {edit ? (
        <h2
          contentEditable suppressContentEditableWarning data-edit="1"
          onBlur={(e) => onPatch("heading", e.currentTarget.textContent ?? "")}
        >{block.heading}</h2>
      ) : (
        <h2>{block.heading}</h2>
      )}
      <div className="pg-team-grid">
        {block.members.map((m, i) => (
          <div key={i} className="pg-member">
            <div className="pg-member__av" style={{ background: HUE_BG[m.hue] }}>{m.initials}</div>
            <div>
              {edit ? (
                <div
                  className="pg-member__name"
                  contentEditable suppressContentEditableWarning data-edit="1"
                  onBlur={(e) => {
                    const members = block.members.map((x, j) => j === i ? { ...x, name: e.currentTarget.textContent ?? "" } : x);
                    onPatch("members", members);
                  }}
                >{m.name}</div>
              ) : (
                <div className="pg-member__name">{m.name}</div>
              )}
              {edit ? (
                <div
                  className="pg-member__role"
                  contentEditable suppressContentEditableWarning data-edit="1"
                  onBlur={(e) => {
                    const members = block.members.map((x, j) => j === i ? { ...x, role: e.currentTarget.textContent ?? "" } : x);
                    onPatch("members", members);
                  }}
                >{m.role}</div>
              ) : (
                <div className="pg-member__role">{m.role}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
