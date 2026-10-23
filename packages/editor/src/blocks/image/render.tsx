"use client";

import { ChevronMedia, MediaPlaceholder, sizedImageSrc } from "@/blocks/_v2";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { ImageBlock } from "@/editor/types";

interface Props {
  block: ImageBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const IMAGE_WIDTH = 1600;
const PROMPT = "Select an image in the inspector";

function ImageBody({ block, edit }: { block: ImageBlock; edit: boolean }) {
  const alt = block.decorative ? "" : (block.alt ?? "");
  const ratio = block.ratio ?? "16/9";
  const placeholder = edit ? PROMPT : undefined;
  if (!block.src) {
    return <MediaPlaceholder label={placeholder} ratio={ratio} />;
  }
  if ((block.frame ?? "chevron") === "plain") {
    return (
      <div className="overflow-hidden rounded-biso-md">
        {/* biome-ignore lint/correctness/useImageSize: sized by its container. */}
        <img
          alt={alt}
          className="block h-auto w-full"
          decoding="async"
          loading="lazy"
          src={sizedImageSrc(block.src, IMAGE_WIDTH)}
        />
      </div>
    );
  }
  return (
    <ChevronMedia
      alt={alt}
      lean={block.lean ?? "left"}
      placeholder={placeholder}
      ratio={ratio}
      src={block.src}
      width={IMAGE_WIDTH}
    />
  );
}

export function ImageRender({ block, edit, onPatch }: Props) {
  return (
    <figure className="m-0">
      <ImageBody block={block} edit={edit} />
      {block.caption || edit ? (
        <figcaption>
          <EditableText
            className="type-body-sm mt-3 text-ink-muted empty:before:opacity-60 empty:before:content-[attr(data-placeholder)]"
            data-placeholder={edit ? "Caption…" : undefined}
            edit={edit}
            onChange={(caption) => onPatch("caption", caption)}
            tag="p"
            value={block.caption ?? ""}
          />
        </figcaption>
      ) : null}
    </figure>
  );
}
