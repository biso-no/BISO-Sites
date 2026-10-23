"use client";

import { Component, type CSSProperties, type ReactNode, Suspense } from "react";
import type { Block } from "@/editor/types";
import { getBlock } from "./index";
import type { PatchFn } from "./types";

interface BlockViewProps {
  block: Block;
  edit: boolean;
  onPatch: PatchFn;
}

/**
 * Renders one block identically in the admin canvas and on the public site.
 *
 * Blocks render bare: the section owns the surface, spacing and width.
 * `data-block` names the type for the gallery page's tests and for anyone
 * inspecting the DOM; `display: contents` keeps it out of the layout.
 *
 * A stored block of a type that no longer exists (a removed block, a
 * hand-edited document) renders nothing on the site. The editor shows a card
 * naming it, so it can be found and deleted.
 */
export function BlockView({ block, edit, onPatch }: BlockViewProps) {
  const def = getBlock(block.type);
  if (!def) {
    return edit ? <UnknownBlockCard type={block.type} /> : null;
  }

  // A malformed block (copilot output, a seed script) must not take the page
  // down with it. The boundary catches it on the client; on the server an
  // error boundary cannot, but Suspense makes React skip the block there and
  // retry it on the client, where the boundary then catches it.
  return (
    <Suspense fallback={null}>
      <div data-block={block.type} style={{ display: "contents" }}>
        <BlockErrorBoundary block={block} edit={edit}>
          <def.Render block={block as never} edit={edit} onPatch={onPatch} />
        </BlockErrorBoundary>
      </div>
    </Suspense>
  );
}

interface BlockErrorBoundaryProps {
  /** A new block object (any edit) clears the error and tries again. */
  block: Block;
  children: ReactNode;
  edit: boolean;
}

/** In the editor's chrome, like "Unknown block": the block can be deleted. */
const ERROR_CARD: CSSProperties = {
  padding: "14px 16px",
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--ink-2)",
  background: "var(--paper-2)",
  border: "0.5px dashed var(--rule-2)",
  borderRadius: 8,
};

/**
 * Catches a block that throws while rendering. The site shows nothing in its
 * place; the editor shows a small card naming the block, so it can be found
 * and deleted.
 */
// biome-ignore lint/style/useReactFunctionComponents: error boundaries can only be class components.
class BlockErrorBoundary extends Component<
  BlockErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: BlockErrorBoundaryProps) {
    if (this.state.failed && previous.block !== this.props.block) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    if (!this.props.edit) {
      return null;
    }
    return (
      <div style={ERROR_CARD}>
        <strong style={{ color: "var(--pg-ink)" }}>
          This block couldn't be shown.
        </strong>{" "}
        Block type: {this.props.block.type}. Delete it, or undo the change that
        broke it.
      </div>
    );
  }
}

function UnknownBlockCard({ type }: { type: string }) {
  return (
    <div style={ERROR_CARD}>
      <strong style={{ color: "var(--pg-ink)" }}>Unknown block: {type}.</strong>{" "}
      It is no longer supported and is not shown on the site. Delete it.
    </div>
  );
}
