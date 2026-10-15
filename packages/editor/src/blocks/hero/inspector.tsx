"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { MediaPicker } from "@/components/editor-shell/inspector/media-picker";
import type { HeroBlock, PageDoc } from "@/editor/types";

interface Props {
  block: HeroBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function HeroInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Layout">
        <div className="pe-variant-grid">
          {(["split", "centered", "full"] as const).map((v) => (
            <button
              className={`pe-variant${block.variant === v ? "on" : ""}`}
              key={v}
              onClick={() => onPatch("variant", v)}
              type="button"
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
      </InspSection>

      <InspSection label="Content">
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
        <InspRow label="Subtitle">
          <input
            onChange={(e) => onPatch("subtitle", e.target.value)}
            value={block.subtitle}
          />
        </InspRow>
      </InspSection>

      <InspSection label="CTA">
        <InspRow label="Label">
          <input
            onChange={(e) => onPatch("ctaLabel", e.target.value)}
            value={block.ctaLabel}
          />
        </InspRow>
        <InspRow label="URL">
          <input
            onChange={(e) => onPatch("ctaUrl", e.target.value)}
            type="url"
            value={block.ctaUrl}
          />
        </InspRow>
      </InspSection>

      <InspSection label="Image">
        <MediaPicker
          accept="image/*"
          onClear={() => {
            onPatch("imageSrc", undefined);
            onPatch("imageFileId", undefined);
          }}
          onPicked={(fileId, url) => {
            onPatch("imageFileId", fileId);
            onPatch("imageSrc", url);
          }}
          onUrl={(url) => {
            onPatch("imageSrc", url);
            onPatch("imageFileId", undefined);
          }}
          src={block.imageSrc}
        />
        {block.imageSrc ? (
          <InspRow label="Alt text">
            <input
              onChange={(e) => onPatch("imageAlt", e.target.value)}
              placeholder="What the photo shows"
              value={block.imageAlt ?? ""}
            />
          </InspRow>
        ) : null}
      </InspSection>
    </>
  );
}
