"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { MediaPicker } from "@/components/editor-shell/inspector/media-picker";
import type { VideoBlock } from "@/editor/types";
import { isEmbedUrl } from "../_v2/media";
import { videoStyleFor } from "./render";

const LOOP_NOTE =
  "Loop needs an uploaded video file. A YouTube or Vimeo link plays as Featured.";

interface Props {
  block: VideoBlock;
  onPatch: PatchFn;
}

export function VideoInspector({ block, onPatch }: Props) {
  const embed = isEmbedUrl(block.url ?? "");
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
            onPatch("posterMime", undefined);
          }}
          onPicked={(fileId, url, mime) => {
            onPatch("posterFileId", fileId);
            onPatch("posterMime", mime || undefined);
            onPatch("poster", url);
          }}
          onUrl={(url) => {
            onPatch("poster", url);
            onPatch("posterFileId", undefined);
            onPatch("posterMime", undefined);
          }}
          src={block.poster}
        />
      </InspSection>
      <InspSection label="Style">
        <Segmented
          choices={[
            { label: "Featured", value: "featured" },
            { label: "Inline", value: "inline" },
            { disabled: embed, label: "Loop", value: "loop" },
          ]}
          onPick={(style) => onPatch("style", style)}
          value={videoStyleFor(block)}
        />
        {embed ? <p className="pe-insp-note">{LOOP_NOTE}</p> : null}
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
