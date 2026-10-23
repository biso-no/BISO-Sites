"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronMedia, MediaPlaceholder } from "@/blocks/_v2";
import type { PatchFn } from "@/blocks/types";
import { useEditorCallbacks } from "@/editor/callbacks";
import type { GalleryBlock, GalleryImage } from "@/editor/types";
import { uploadGalleryFiles } from "./upload";

interface Props {
  block: GalleryBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const COLLAGE_MAX = 5;
const BIG_WIDTH = 1600;
const TILE_WIDTH = 800;

/**
 * Tiles are 4/3 everywhere so --ar always matches the rendered box. In the
 * 5-image collage the big tile spans two rows and is sized by the grid
 * (`fill`), whose real ratio is about 0.75 plus a sliver for the gap.
 */
const TILE_RATIO = "4/3";

interface Tile {
  image: GalleryImage;
  index: number;
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Remove image"
      className="absolute top-2 right-2 z-10 grid size-6 cursor-pointer place-items-center rounded-biso-pill border-0 bg-surface-raised text-ink text-xs shadow-elev-1"
      onClick={onClick}
      type="button"
    >
      ✕
    </button>
  );
}

export function GalleryRender({ block, edit, onPatch }: Props) {
  const { uploadFile } = useEditorCallbacks();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const all = block.images ?? [];
  const tiles: Tile[] = all
    .map((image, index) => ({ image, index }))
    .filter((t) => t.image.src);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) {
      return;
    }
    setUploadError(null);
    startTransition(async () => {
      const { added, error } = await uploadGalleryFiles(files, uploadFile);
      if (added.length > 0) {
        onPatch("images", [...all, ...added]);
      }
      setUploadError(error);
    });
    // Reset so picking the same file again re-fires the change event.
    e.target.value = "";
  }

  if (tiles.length === 0 && !edit) {
    return null;
  }

  const layout = block.layout ?? "collage";
  const bigCollage = layout === "collage" && tiles.length >= COLLAGE_MAX;
  const shown = layout === "collage" ? tiles.slice(0, COLLAGE_MAX) : tiles;

  let wrapperClass = "grid grid-cols-2 gap-4";
  if (layout === "grid") {
    wrapperClass = "grid grid-cols-2 @lg:grid-cols-3 gap-4";
  } else if (layout === "row") {
    wrapperClass = "flex gap-4 overflow-x-auto snap-x";
  } else if (bigCollage) {
    wrapperClass =
      "grid grid-cols-2 gap-4 @2xl:grid-cols-[2fr_1fr_1fr] @2xl:grid-rows-2";
  }

  const tileClass = (i: number): string => {
    if (layout === "row") {
      return "relative w-56 shrink-0 snap-start";
    }
    if (layout === "collage" && i === 0) {
      return bigCollage
        ? "relative col-span-2 @2xl:col-span-1 @2xl:row-span-2 @2xl:min-h-0 @2xl:[--cut-len:calc(var(--shear-run,0.2309)*100cqh)] @2xl:[container-type:size]"
        : "relative col-span-2";
    }
    return "relative";
  };

  return (
    <div>
      {shown.length > 0 ? (
        <div className={wrapperClass}>
          {shown.map(({ image, index }, i) => {
            const isBig = layout === "collage" && i === 0;
            let ratio: "4/3" | "4/5" = TILE_RATIO;
            if (layout === "row") {
              ratio = "4/5";
            }
            return (
              <div
                className={tileClass(i)}
                key={`${index}-${image.fileId ?? image.src}`}
              >
                <ChevronMedia
                  alt={image.alt ?? ""}
                  className={
                    isBig && bigCollage
                      ? "pg-chevron-fill @2xl:aspect-auto @2xl:h-full @2xl:[&>img]:absolute @2xl:[&>img]:inset-0"
                      : undefined
                  }
                  lean={i % 2 === 0 ? "left" : "right"}
                  ratio={ratio}
                  src={image.src}
                  width={isBig ? BIG_WIDTH : TILE_WIDTH}
                />
                {edit ? (
                  <RemoveButton
                    onClick={() =>
                      onPatch(
                        "images",
                        all.filter((_, idx) => idx !== index)
                      )
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <MediaPlaceholder label="Add images to the gallery" ratio="16/9" />
      )}
      {edit ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            className="type-body-sm cursor-pointer rounded-biso-md border border-edge border-dashed px-4 py-2 text-ink-muted"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {isPending ? "Uploading…" : "+ Add images"}
          </button>
          {uploadError ? (
            <p className="type-body-sm m-0 text-ink-muted" role="alert">
              {uploadError}
            </p>
          ) : null}
        </div>
      ) : null}
      {edit ? (
        <input
          accept="image/*"
          className="hidden"
          multiple
          onChange={handleFiles}
          ref={inputRef}
          type="file"
        />
      ) : null}
    </div>
  );
}
