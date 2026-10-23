"use client";

import { safeHref } from "@/blocks/_v2";
import type { LinkButton } from "@/editor/types";
import { type Choice, InspRow, Segmented } from "./insp-parts";

const BUTTON_STYLES: Choice<LinkButton["style"]>[] = [
  { label: "Primary", value: "primary" },
  { label: "Secondary", value: "secondary" },
];

const NO_LINK = "No link yet. This button can't be clicked.";
const BAD_LINK = "This link isn't allowed, so the button can't be clicked.";

/** The note under the Link input, or null when the link works. */
export function linkNote(href: string): string | null {
  if (safeHref(href) !== null) {
    return null;
  }
  return href.trim() === "" ? NO_LINK : BAD_LINK;
}

/** Label, Link and Style for one button, shared by every button inspector. */
export function ButtonFields({
  button,
  onChange,
}: {
  button: LinkButton;
  onChange: (button: LinkButton) => void;
}) {
  const note = linkNote(button.href);
  return (
    <>
      <InspRow label="Label">
        <input
          aria-label="Button label"
          onChange={(e) => onChange({ ...button, label: e.target.value })}
          value={button.label}
        />
      </InspRow>
      <InspRow label="Link">
        <input
          aria-label="Button link"
          onChange={(e) => onChange({ ...button, href: e.target.value })}
          placeholder="https://… or /page or #section"
          value={button.href}
        />
      </InspRow>
      {note ? (
        <p className="pe-insp-note" role="status">
          {note}
        </p>
      ) : null}
      <InspRow label="Style">
        <Segmented
          choices={BUTTON_STYLES}
          onPick={(style) => onChange({ ...button, style })}
          value={button.style}
        />
      </InspRow>
    </>
  );
}
