"use client";

import type { PatchFn } from "@/blocks/types";
import type { ProfileHeaderBlock } from "@/editor/types";

interface Props {
  block: ProfileHeaderBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function ProfileHeaderRender({ block, edit }: Props) {
  if (!edit) {
    // On the public side the auth-aware shell replaces this with real user data.
    // Render nothing so the host component can gate it properly.
    return null;
  }

  return (
    <div className="pg-profileheader pg-block">
      <div className="pg-profileheader__row">
        {block.showAvatar && (
          <div aria-hidden="true" className="pg-profileheader__avatar">
            <span>JD</span>
          </div>
        )}
        <div className="pg-profileheader__info">
          <div className="pg-profileheader__name">
            {block.heading ?? "My BISO"}
          </div>
          <div className="pg-profileheader__role">Member · Oslo</div>
        </div>
      </div>
      {block.showStats && (
        <div className="pg-profileheader__stats">
          <div className="pg-profileheader__stat">
            <span className="pg-profileheader__stat-num">3</span>
            <span className="pg-profileheader__stat-label">Units</span>
          </div>
          <div className="pg-profileheader__stat">
            <span className="pg-profileheader__stat-num">12</span>
            <span className="pg-profileheader__stat-label">Events</span>
          </div>
          <div className="pg-profileheader__stat">
            <span className="pg-profileheader__stat-num">2</span>
            <span className="pg-profileheader__stat-label">Applications</span>
          </div>
        </div>
      )}
      {edit && (
        <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 12 }}>
          Shows real account data for signed-in users on the live page.
        </p>
      )}
    </div>
  );
}
