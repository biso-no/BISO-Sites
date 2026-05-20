"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
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
          onClear={() => {
            onPatch("url", "");
            onPatch("fileId", "");
          }}
          onPicked={(fileId, url) => {
            onPatch("fileId", fileId);
            onPatch("url", url);
          }}
          onUrl={(url) => {
            onPatch("url", url);
            onPatch("fileId", "");
          }}
          src={block.url}
        />
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            margin: "6px 0 0",
            lineHeight: 1.45,
          }}
        >
          Supports YouTube, Vimeo URLs, or upload an mp4/mov.
        </p>
      </InspSection>
      <InspSection label="Settings">
        <InspRow label="Caption">
          <input
            onChange={(e) => onPatch("caption", e.target.value)}
            placeholder="Optional caption…"
            value={block.caption}
          />
        </InspRow>
      </InspSection>
    </>
  );
}
