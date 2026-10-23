"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { MediaPicker } from "@/components/editor-shell/inspector/media-picker";
import type { FrameRatio, ImageBlock, PageDoc } from "@/editor/types";

interface Props {
  block: ImageBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

const RATIOS: FrameRatio[] = [
  "21/9",
  "16/9",
  "3/2",
  "4/3",
  "1/1",
  "4/5",
  "3/4",
];

export function ImageInspector({ block, onPatch }: Props) {
  const needsAlt =
    !(block.decorative || (block.alt ?? "").trim()) && !!block.src;
  return (
    <>
      <InspSection label="Image">
        <MediaPicker
          accept="image/*"
          onClear={() => {
            onPatch("src", undefined);
            onPatch("fileId", undefined);
            onPatch("mime", undefined);
          }}
          onPicked={(fileId, url, mime) => {
            onPatch("fileId", fileId);
            onPatch("mime", mime || undefined);
            onPatch("src", url);
          }}
          onUrl={(url) => {
            onPatch("src", url);
            onPatch("fileId", undefined);
            onPatch("mime", undefined);
          }}
          src={block.src}
        />
        <InspRow label="Alt text">
          <input
            disabled={block.decorative}
            onChange={(e) => onPatch("alt", e.target.value)}
            placeholder="Describe the image"
            value={block.alt ?? ""}
          />
        </InspRow>
        <label className="pe-check">
          <input
            checked={!!block.decorative}
            onChange={(e) => onPatch("decorative", e.target.checked)}
            type="checkbox"
          />
          Decorative image
        </label>
        {needsAlt ? (
          <p className="pe-insp-note" role="status">
            Add alt text, or mark the image as decorative. Screen readers need
            one or the other.
          </p>
        ) : null}
      </InspSection>
      <InspSection label="Frame">
        <Segmented
          choices={[
            { label: "Chevron", value: "chevron" },
            { label: "Plain", value: "plain" },
          ]}
          onPick={(frame) => onPatch("frame", frame)}
          value={block.frame ?? "chevron"}
        />
      </InspSection>
      <InspSection label="Ratio">
        <Segmented
          choices={RATIOS.map((r) => ({
            label: r.replace("/", ":"),
            value: r,
          }))}
          onPick={(ratio) => onPatch("ratio", ratio)}
          value={block.ratio ?? "16/9"}
        />
      </InspSection>
      {(block.frame ?? "chevron") === "chevron" ? (
        <InspSection label="Lean">
          <Segmented
            choices={[
              { label: "Left", value: "left" },
              { label: "Right", value: "right" },
            ]}
            onPick={(lean) => onPatch("lean", lean)}
            value={block.lean ?? "left"}
          />
        </InspSection>
      ) : null}
      <InspSection label="Caption">
        <input
          onChange={(e) => onPatch("caption", e.target.value)}
          placeholder="Caption…"
          value={block.caption ?? ""}
        />
      </InspSection>
    </>
  );
}
