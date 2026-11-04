"use client";

import { Suspense, useEffect } from "react";
import type { PatchFn } from "@/blocks/types";
import type { TextBlock } from "@/editor/types";
import { bodyPatch, bodyToHtml } from "./body";
import { RichTextField } from "./lazy-field";

interface TextExpandViewProps {
  block: TextBlock;
  onClose: () => void;
  onPageHistory?: (step: "undo" | "redo") => void;
  onPatch: PatchFn;
}

/**
 * The block's text in a wide writing view over the editor, for long texts
 * that feel cramped in the panel: the panel's field and toolbar, wider and
 * in a larger size. It writes the body as the panel does, so the canvas
 * behind it follows each change; the scrim has no blur, so that shows.
 * Drawn in place, not in a portal, so the editor's theme and dark mode reach
 * it as they reach `.pe-confirm`.
 *
 * Close or Escape closes it, wherever focus is while it is open: a click on
 * the panel's chrome focuses the panel. A press on the scrim does not, so a
 * stray click never ends the writing. An Escape that a control inside took
 * first (the link input, an open popover) leaves it open. The panel scrolls
 * on a window too short for it.
 */
export function TextExpandView({
  block,
  onClose,
  onPageHistory,
  onPatch,
}: TextExpandViewProps) {
  // On the document, as the event bubbles: the link input's handler and the
  // popovers' capturing listener run before it, and stop or prevent the key
  // they take.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="pe-rt-expand">
      <div
        aria-label="Text"
        aria-modal="true"
        className="pe-rt-expand__panel"
        role="dialog"
        tabIndex={-1}
      >
        <div className="pe-rt-expand__hd">
          <span className="pe-insp-section__h">Text</span>
          <button className="pe-rt-expand-btn" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {/* Outside the panel's gap, so the toolbar sits on its field. */}
        <div>
          <Suspense fallback={<div className="pe-rt-field" />}>
            <RichTextField
              autoFocus
              html={bodyToHtml(block.body)}
              label="Text"
              onChange={bodyPatch(block, onPatch)}
              onPageHistory={onPageHistory}
              variant="panel"
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
