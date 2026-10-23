"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { MediaPicker } from "@/components/editor-shell/inspector/media-picker";
import type { VideoBlock } from "@/editor/types";

interface Props {
  block: VideoBlock;
  onPatch: PatchFn;
}

export function VideoInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Video">
        <MediaPicker
          accept="video/*"
          kind="video"
          onClear={() => {
            onPatch("url", undefined);
            onPatch("fileId", undefined);
          }}
          onPicked={(fileId, url) => {
            onPatch("fileId", fileId);
            onPatch("url", url);
          }}
          onUrl={(url) => {
            onPatch("url", url);
            onPatch("fileId", undefined);
          }}
          src={block.url}
        />
        <p className="pe-insp-note">
          Paste a YouTube or Vimeo link, or upload an mp4.
        </p>
      </InspSection>
      <InspSection label="Poster">
        <MediaPicker
          accept="image/*"
          kind="image"
          onClear={() => {
            onPatch("poster", undefined);
            onPatch("posterFileId", undefined);
          }}
          onPicked={(fileId, url) => {
            onPatch("posterFileId", fileId);
            onPatch("poster", url);
          }}
          onUrl={(url) => {
            onPatch("poster", url);
            onPatch("posterFileId", undefined);
          }}
          src={block.poster}
        />
      </InspSection>
      <InspSection label="Style">
        <Segmented
          choices={[
            { label: "Featured", value: "featured" },
            { label: "Inline", value: "inline" },
            { label: "Loop", value: "loop" },
          ]}
          onPick={(style) => onPatch("style", style)}
          value={block.style ?? "featured"}
        />
      </InspSection>
      <InspSection label="Ratio">
        <Segmented
          choices={[
            { label: "16:9", value: "16/9" },
            { label: "21:9", value: "21/9" },
          ]}
          onPick={(ratio) => onPatch("ratio", ratio)}
          value={block.ratio ?? "16/9"}
        />
      </InspSection>
      <InspSection label="Text">
        <InspRow label="Label">
          <input
            onChange={(e) => onPatch("label", e.target.value)}
            placeholder="Shown on the poster"
            value={block.label ?? ""}
          />
        </InspRow>
        <InspRow label="Caption">
          <input
            onChange={(e) => onPatch("caption", e.target.value)}
            placeholder="Caption…"
            value={block.caption ?? ""}
          />
        </InspRow>
      </InspSection>
    </>
  );
}
