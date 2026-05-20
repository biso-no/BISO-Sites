"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { MediaPicker } from "@/components/editor-shell/inspector/media-picker";
import type { ImageBlock } from "@/editor/types";

interface Props {
  block: ImageBlock;
  onPatch: PatchFn;
}

export function ImageInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Image">
        <MediaPicker
          accept="image/*"
          onClear={() => {
            onPatch("src", undefined);
            onPatch("fileId", undefined);
          }}
          onPicked={(fileId, url) => {
            onPatch("fileId", fileId);
            onPatch("src", url);
          }}
          onUrl={(url) => {
            onPatch("src", url);
            onPatch("fileId", undefined);
          }}
          src={block.src}
        />
      </InspSection>
      <InspSection label="Settings">
        <InspRow label="Caption">
          <input
            onChange={(e) => onPatch("caption", e.target.value)}
            placeholder="Caption…"
            value={block.caption ?? ""}
          />
        </InspRow>
        <InspRow label="Aspect">
          <select
            onChange={(e) => onPatch("aspect", e.target.value)}
            value={block.aspect ?? "16/9"}
          >
            <option value="16/9">16:9</option>
            <option value="4/3">4:3</option>
            <option value="1/1">1:1</option>
            <option value="3/4">3:4 portrait</option>
            <option value="21/9">21:9 cinematic</option>
          </select>
        </InspRow>
      </InspSection>
    </>
  );
}
