"use client";

import { useRef, useState, useTransition } from "react";
import { knownKey } from "@/blocks/_v2/known-key";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import { MediaPicker } from "@/components/editor-shell/inspector/media-picker";
import { useEditorCallbacks } from "@/editor/callbacks";
import type { GalleryBlock, GalleryImage, PageDoc } from "@/editor/types";
import { LAYOUTS } from "./render";
import { uploadGalleryFiles } from "./upload";

interface Props {
  block: GalleryBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

/** A picked or linked image without its file fields. */
function withoutFile({
  fileId: _fileId,
  mime: _mime,
  ...image
}: GalleryImage): GalleryImage {
  return image;
}

/** One gallery image's picker and alt text. */
export function GalleryImageFields({
  item,
  update,
}: {
  item: GalleryImage;
  update: (item: GalleryImage) => void;
}) {
  return (
    <>
      <MediaPicker
        accept="image/*"
        onClear={() => update({ ...withoutFile(item), src: "" })}
        onPicked={(fileId, url, mime) =>
          update(
            mime
              ? { ...item, fileId, mime, src: url }
              : { ...withoutFile(item), fileId, src: url }
          )
        }
        onUrl={(url) => update({ ...withoutFile(item), src: url })}
        src={item.src || undefined}
      />
      <InspRow label="Alt text">
        <input
          onChange={(e) => update({ ...item, alt: e.target.value })}
          placeholder="Describe the image"
          value={item.alt ?? ""}
        />
      </InspRow>
      {item.src && !item.alt?.trim() ? (
        <p className="pe-insp-note" role="status">
          Add alt text so screen readers can describe this image.
        </p>
      ) : null}
    </>
  );
}

export function GalleryInspector({ block, onPatch }: Props) {
  const { uploadFile } = useEditorCallbacks();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const images = listOf<GalleryImage>(block.images);
  const layout = knownKey(LAYOUTS, block.layout, "collage");

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) {
      return;
    }
    setUploadError(null);
    startTransition(async () => {
      const { added, error } = await uploadGalleryFiles(files, uploadFile);
      if (added.length > 0) {
        onPatch("images", [...images, ...added]);
      }
      setUploadError(error);
    });
    e.target.value = "";
  }

  return (
    <>
      <InspSection label="Layout">
        <Segmented
          choices={[
            { label: "Collage", value: "collage" },
            { label: "Grid", value: "grid" },
            { label: "Row", value: "row" },
          ]}
          onPick={(layout) => onPatch("layout", layout)}
          value={layout}
        />
        {layout === "collage" ? (
          <p className="pe-insp-note">
            The collage shows up to 5 images; 5 gives the big first tile.
          </p>
        ) : null}
      </InspSection>
      <InspSection label="Images">
        <ItemList
          addLabel="+ Add image"
          items={images}
          newItem={(): GalleryImage => ({ src: "" })}
          onChange={(next) => onPatch("images", next)}
          renderItem={(item, update) => (
            <GalleryImageFields item={item} update={update} />
          )}
          title={(_, i) => `Image ${i + 1}`}
        />
        <button
          className="pe-insp-link"
          disabled={isPending}
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          {isPending ? "Uploading…" : "Upload several images"}
        </button>
        {uploadError ? (
          <p className="pe-insp-note" role="alert">
            {uploadError}
          </p>
        ) : null}
        <input
          accept="image/*"
          className="hidden"
          multiple
          onChange={handleFiles}
          ref={fileRef}
          type="file"
        />
      </InspSection>
    </>
  );
}
