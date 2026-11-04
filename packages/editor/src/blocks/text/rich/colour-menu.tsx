"use client";

import type { TextColourToken } from "@repo/shared/utils/text-colour-tokens";
import type { TextSwatch } from "@repo/shared/utils/text-colours";
import type { PlateEditor } from "platejs/react";
import { setColour } from "./commands";
import { RichPopover } from "./popover";

/** A colour dot in `paper`, or an empty ring when there is no colour. */
function Swatch({ className, paper }: { className?: string; paper?: string }) {
  const classes = ["pe-rt-swatch", className, paper ? "" : "pe-rt-swatch--none"]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      aria-hidden="true"
      className={classes}
      style={paper ? { backgroundColor: paper } : undefined}
    />
  );
}

interface ColourMenuProps {
  current: TextColourToken | null;
  editor: PlateEditor;
  swatches: readonly TextSwatch[];
}

/**
 * The text colour button, with a dot in the colour at the selection, and its
 * swatches: Default (no colour), then the page theme's colours, each shown
 * as it looks on white.
 */
export function ColourMenu({ current, editor, swatches }: ColourMenuProps) {
  const shown = swatches.find((swatch) => swatch.token === current);
  return (
    <RichPopover
      button={(props) => (
        <button {...props} aria-label="Text colour" className="pe-rt-btn">
          <span aria-hidden="true">A</span>
          <Swatch className="pe-rt-colour__dot" paper={shown?.paper} />
        </button>
      )}
      label="Text colour"
    >
      {(close) => {
        const choose = (colour: TextColourToken | null) => {
          setColour(editor, colour);
          close(true);
        };
        return (
          <>
            <button
              aria-pressed={current === null}
              className="pe-rt-pop__item"
              onClick={() => choose(null)}
              type="button"
            >
              <Swatch />
              Default
            </button>
            {swatches.map((swatch) => (
              <button
                aria-pressed={swatch.token === current}
                className="pe-rt-pop__item"
                key={swatch.token}
                onClick={() => choose(swatch.token)}
                type="button"
              >
                <Swatch paper={swatch.paper} />
                {swatch.label}
              </button>
            ))}
          </>
        );
      }}
    </RichPopover>
  );
}
