"use client";

import type { PatchFn } from "@/blocks/types";
import type { TeamBlock, TeamMember } from "@/editor/types";
import { HUE_COLORS } from "@/theme/presets";

const HUE_BG: Record<TeamMember["hue"], string> = {
  blue: `linear-gradient(135deg,${HUE_COLORS.blue},${HUE_COLORS.navy})`,
  navy: `linear-gradient(135deg,${HUE_COLORS.navy},${HUE_COLORS.slate})`,
  sky: `linear-gradient(135deg,${HUE_COLORS.sky},${HUE_COLORS.blue})`,
  gold: `linear-gradient(135deg,${HUE_COLORS.gold},${HUE_COLORS.blue})`,
  slate: `linear-gradient(135deg,${HUE_COLORS.slate},${HUE_COLORS.navy})`,
};

interface Props {
  block: TeamBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function TeamRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-team pg-block">
      {edit ? (
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: contentEditable and editor preview controls intentionally use custom interaction surfaces.
        <h2
          contentEditable
          data-edit="1"
          onBlur={(e) => onPatch("heading", e.currentTarget.textContent ?? "")}
          suppressContentEditableWarning
        >
          {block.heading}
        </h2>
      ) : (
        <h2>{block.heading}</h2>
      )}
      <div className="pg-team-grid">
        {block.members.map((m, i) => (
          <div className="pg-member" key={i}>
            <div
              className="pg-member__av"
              style={{ background: HUE_BG[m.hue] }}
            >
              {m.initials}
            </div>
            <div>
              {edit ? (
                // biome-ignore lint/a11y/useSemanticElements: contentEditable and editor preview controls intentionally use custom interaction surfaces.
                <div
                  className="pg-member__name"
                  contentEditable
                  data-edit="1"
                  onBlur={(e) => {
                    const members = block.members.map((x, j) =>
                      j === i
                        ? { ...x, name: e.currentTarget.textContent ?? "" }
                        : x
                    );
                    onPatch("members", members);
                  }}
                  role="textbox"
                  suppressContentEditableWarning
                  tabIndex={0}
                >
                  {m.name}
                </div>
              ) : (
                <div className="pg-member__name">{m.name}</div>
              )}
              {edit ? (
                // biome-ignore lint/a11y/useSemanticElements: contentEditable and editor preview controls intentionally use custom interaction surfaces.
                <div
                  className="pg-member__role"
                  contentEditable
                  data-edit="1"
                  onBlur={(e) => {
                    const members = block.members.map((x, j) =>
                      j === i
                        ? { ...x, role: e.currentTarget.textContent ?? "" }
                        : x
                    );
                    onPatch("members", members);
                  }}
                  role="textbox"
                  suppressContentEditableWarning
                  tabIndex={0}
                >
                  {m.role}
                </div>
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
