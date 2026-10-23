"use client";

import type { ReactNode } from "react";
import type { Block } from "@/editor/types";
import type { ResolvedBackground } from "./_primitives/layout-types";
import { getBlock } from "./index";
import type { PatchFn } from "./types";

interface BlockViewProps {
  background: ResolvedBackground;
  block: Block;
  edit: boolean;
  onPatch: PatchFn;
}

/**
 * Renders one block identically in the admin canvas and on the public site.
 *
 * Blocks rebuilt on `BlockSection` apply the surface themselves; every other
 * block is framed here. `block.layout` is ignored: the section owns spacing
 * and width.
 */
export function BlockView({
  background,
  block,
  edit,
  onPatch,
}: BlockViewProps) {
  const def = getBlock(block.type);
  if (!def) {
    return null;
  }

  const rendered = (
    <def.Render
      background={background}
      block={block as never}
      edit={edit}
      onPatch={onPatch}
    />
  );

  if (def.appliesLayout || def.v2) {
    return rendered;
  }

  return <LayoutFrame background={background}>{rendered}</LayoutFrame>;
}

interface LayoutFrameProps {
  background: ResolvedBackground;
  children: ReactNode;
}

/**
 * The section paints the surface, so the frame paints none. `data-background`
 * stays: `blocks.css` reads it to rebind the site tokens the legacy blocks'
 * copy follows on a dark section. Sections own spacing and width, so the frame
 * is always compact and full width. `data-auto` lets the dark banner blocks
 * (contact, full hero) keep their own panel.
 */
function LayoutFrame({ background, children }: LayoutFrameProps) {
  return (
    <div
      className="pg-section relative text-foreground"
      data-auto=""
      data-background={background}
      data-spacing="compact"
      data-width="full"
    >
      <div className="pg-section__inner">{children}</div>
    </div>
  );
}
