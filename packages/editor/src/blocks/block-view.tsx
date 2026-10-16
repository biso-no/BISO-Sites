"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";
import type { Block } from "@/editor/types";
import { SURFACE } from "./_primitives/block-section";
import type {
  BlockLayout,
  ResolvedBackground,
} from "./_primitives/layout-types";
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
 * Blocks rebuilt on `BlockSection` apply the Design panel themselves. Every
 * other block is still styled by `blocks.css` and never reads `layout`, so it
 * is framed here instead: without the frame, the panel's background, spacing
 * and width choices would be saved but change nothing on the page.
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

  if (def.appliesLayout) {
    return rendered;
  }

  return (
    <LayoutFrame background={background} layout={block.layout}>
      {rendered}
    </LayoutFrame>
  );
}

interface LayoutFrameProps {
  background: ResolvedBackground;
  children: ReactNode;
  layout?: BlockLayout;
}

/**
 * Paints the resolved surface with the same classes `BlockSection` uses, so a
 * framed block and a migrated one look alike on every background. The data
 * attributes drive the spacing and width rules in `blocks.css`; `data-auto`
 * lets the dark banner blocks (contact, full hero) keep their own panel until
 * an editor picks a background on purpose.
 */
function LayoutFrame({ background, children, layout }: LayoutFrameProps) {
  const chosen = layout?.background;
  const automatic = !chosen || chosen === "auto";

  return (
    <div
      className={cn("pg-section relative text-foreground", SURFACE[background])}
      data-auto={automatic ? "" : undefined}
      data-background={background}
      data-spacing={layout?.spacing ?? "normal"}
      data-width={layout?.width ?? "wide"}
    >
      <div className="pg-section__inner">{children}</div>
    </div>
  );
}
