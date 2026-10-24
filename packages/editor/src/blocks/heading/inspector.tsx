"use client";

import { knownKey } from "@/blocks/_v2/known-key";
import type { PatchFn } from "@/blocks/types";
import {
  type LinkNotes,
  linkNote,
} from "@/components/editor-shell/inspector/button-fields";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import type { HeadingBlock, PageDoc } from "@/editor/types";
import { TITLE_CLASS } from "./render";

const SIZES = [
  { label: "Small", value: "small" },
  { label: "Medium", value: "medium" },
  { label: "Large", value: "large" },
] as const;

const HEADING_LINK_NOTES: LinkNotes = {
  missing: "No link yet, so the link and its underline won't show.",
  unsafe: "This link isn't allowed, so the link and its underline won't show.",
};

const HEADING_LABEL_NOTE =
  "No label yet, so the link and its underline won't show.";

/** The note for a link someone has started on; none for no link at all. */
function headingLinkNote(link: HeadingBlock["link"]): string | null {
  const href = typeof link?.href === "string" ? link.href : "";
  const label = typeof link?.label === "string" ? link.label : "";
  if (!(href.trim() || label.trim())) {
    return null;
  }
  return (
    linkNote(href, HEADING_LINK_NOTES) ??
    (label.trim() ? null : HEADING_LABEL_NOTE)
  );
}

interface Props {
  block: HeadingBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function HeadingInspector({ block, onPatch }: Props) {
  const note = headingLinkNote(block.link);
  return (
    <>
      <InspSection label="Heading">
        <InspRow label="Eyebrow">
          <input
            onChange={(e) => onPatch("eyebrow", e.target.value)}
            value={block.eyebrow}
          />
        </InspRow>
        <InspRow label="Title">
          <input
            onChange={(e) => onPatch("title", e.target.value)}
            value={block.title}
          />
        </InspRow>
        <InspRow label="Intro">
          <textarea
            onChange={(e) => onPatch("intro", e.target.value)}
            rows={3}
            value={block.intro}
          />
        </InspRow>
        <InspRow label="Size">
          <Segmented
            choices={[...SIZES]}
            onPick={(size) => onPatch("size", size)}
            value={knownKey(TITLE_CLASS, block.size, "medium")}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Link (draws the underline)">
        <InspRow label="Label">
          <input
            onChange={(e) =>
              onPatch("link", {
                href: block.link?.href ?? "",
                label: e.target.value,
              })
            }
            value={block.link?.label ?? ""}
          />
        </InspRow>
        <InspRow label="URL">
          <input
            onChange={(e) =>
              onPatch("link", {
                href: e.target.value,
                label: block.link?.label ?? "",
              })
            }
            value={block.link?.href ?? ""}
          />
        </InspRow>
        {note ? (
          <p className="pe-insp-note" role="status">
            {note}
          </p>
        ) : null}
      </InspSection>
    </>
  );
}
