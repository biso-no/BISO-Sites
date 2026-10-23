"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import type { HeadingBlock, PageDoc } from "@/editor/types";

const SIZES = [
  { label: "Small", value: "small" },
  { label: "Medium", value: "medium" },
  { label: "Large", value: "large" },
] as const;

interface Props {
  block: HeadingBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function HeadingInspector({ block, onPatch }: Props) {
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
            value={block.size ?? "medium"}
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
      </InspSection>
    </>
  );
}
