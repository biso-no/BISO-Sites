"use client";

import type { SlateEditor } from "platejs";
import type { PlateEditor } from "platejs/react";
import { clearFormatting, insertDivider, toggleRichMark } from "./commands";
import { RichPopover } from "./popover";

interface MoreMenuProps {
  editor: PlateEditor;
  /** The caret is in a table cell, which holds no divider. */
  inCell: boolean;
  strikethrough: boolean;
}

const strike = (editor: SlateEditor) => toggleRichMark(editor, "strikethrough");

/**
 * The ⋯ button and what is used less often: strikethrough, a divider after
 * the block at the caret, and clearing the selection's formatting.
 */
export function MoreMenu({ editor, inCell, strikethrough }: MoreMenuProps) {
  return (
    <RichPopover
      button={(props) => (
        <button {...props} aria-label="More formatting" className="pe-rt-btn">
          ⋯
        </button>
      )}
      label="More formatting"
    >
      {(close) => {
        const run = (command: (target: SlateEditor) => void) => () => {
          command(editor);
          close(true);
        };
        return (
          <>
            <button
              aria-pressed={strikethrough}
              className="pe-rt-pop__item"
              onClick={run(strike)}
              type="button"
            >
              <StrikethroughIcon />
              Strikethrough
            </button>
            <button
              className="pe-rt-pop__item"
              disabled={inCell}
              onClick={run(insertDivider)}
              type="button"
            >
              <DividerIcon />
              Divider
            </button>
            <button
              className="pe-rt-pop__item"
              onClick={run(clearFormatting)}
              type="button"
            >
              <ClearFormattingIcon />
              Clear formatting
            </button>
          </>
        );
      }}
    </RichPopover>
  );
}

function StrikethroughIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      viewBox="0 0 24 24"
      width="12"
    >
      <path
        d="M4 12h16M16.5 7C15.8 5.3 14.2 4.5 12 4.5c-2.6 0-4.5 1.3-4.5 3.4 0 1.6 1 2.6 3 3.1M8 16.6c.6 1.8 2.2 2.9 4.4 2.9 2.7 0 4.6-1.4 4.6-3.6 0-.8-.2-1.4-.7-1.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function DividerIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      viewBox="0 0 24 24"
      width="12"
    >
      <path
        d="M3 12h18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ClearFormattingIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      viewBox="0 0 24 24"
      width="12"
    >
      <path
        d="M5 7V5h12v2M11 5v14M9 19h4M15 14l5 5M20 14l-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
