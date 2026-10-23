"use client";

import type { PatchFn } from "@/blocks/types";
import type {
  HeaderCrumb,
  HeaderVariant,
  LinkButton,
  MediaRef,
  PageHeader,
} from "@/editor/types";
import { ButtonFields } from "./button-fields";
import { type Choice, InspRow, InspSection, Segmented } from "./insp-parts";
import { ItemList } from "./item-list";
import { MediaPicker } from "./media-picker";

const VARIANTS: Choice<HeaderVariant>[] = [
  { label: "Split", value: "split" },
  { label: "Full", value: "full" },
  { label: "Plain", value: "plain" },
];
const MAX_BUTTONS = 2;
const VIDEO_FILE_RE = /\.(mp4|mov|webm|ogg)(\?|$)/i;

/**
 * An upload says what it is by its file type. A pasted URL only has its
 * extension to go by, and an Appwrite view URL has none, so it is an image
 * unless it ends like a video file.
 */
function kindOf(src: string, mime?: string): MediaRef["kind"] {
  if (mime) {
    return mime.startsWith("video/") ? "video" : "image";
  }
  return VIDEO_FILE_RE.test(src) ? "video" : "image";
}

/** New media keeps the alt text already written. */
function withAlt(media: MediaRef, alt: string | undefined): MediaRef {
  return alt ? { ...media, alt } : media;
}

function withoutPoster({
  poster: _poster,
  posterFileId: _posterFileId,
  ...media
}: MediaRef): MediaRef {
  return media;
}

interface HeaderPanelProps {
  header: PageHeader;
  onPatch: PatchFn;
  onRemove: () => void;
}

/** The page header's inspector, shown while the header is selected. */
export function HeaderPanel({ header, onPatch, onRemove }: HeaderPanelProps) {
  const { media } = header;
  return (
    <>
      <div className="pe-insp-hd">
        <div>
          <div className="pe-insp-hd__ti">Page header</div>
          <div className="pe-insp-hd__sub">The top of the page</div>
        </div>
      </div>

      <InspSection label="Layout">
        <InspRow label="Variant">
          <Segmented
            choices={VARIANTS}
            onPick={(variant) => onPatch("variant", variant)}
            value={header.variant}
          />
        </InspRow>
      </InspSection>

      <InspSection label="Text">
        <InspRow label="Eyebrow">
          <input
            aria-label="Eyebrow"
            onChange={(e) => onPatch("eyebrow", e.target.value)}
            value={header.eyebrow}
          />
        </InspRow>
        <InspRow label="Title">
          <input
            aria-label="Title"
            onChange={(e) => onPatch("title", e.target.value)}
            value={header.title}
          />
        </InspRow>
        <InspRow label="Lede">
          <textarea
            aria-label="Lede"
            onChange={(e) => onPatch("lede", e.target.value)}
            rows={3}
            value={header.lede}
          />
        </InspRow>
      </InspSection>

      <InspSection label="Breadcrumbs">
        <ItemList<HeaderCrumb>
          addLabel="Add breadcrumb"
          items={header.crumbs}
          newItem={() => ({ href: "", label: "" })}
          onChange={(crumbs) => onPatch("crumbs", crumbs)}
          renderItem={(crumb, update) => (
            <>
              <InspRow label="Label">
                <input
                  aria-label="Breadcrumb label"
                  onChange={(e) => update({ ...crumb, label: e.target.value })}
                  value={crumb.label}
                />
              </InspRow>
              <InspRow label="Link">
                <input
                  aria-label="Breadcrumb link"
                  onChange={(e) => update({ ...crumb, href: e.target.value })}
                  placeholder="/units (none for this page)"
                  value={crumb.href ?? ""}
                />
              </InspRow>
            </>
          )}
          title={(crumb, i) => crumb.label || `Breadcrumb ${i + 1}`}
        />
      </InspSection>

      <InspSection label="Buttons">
        <ItemList<LinkButton>
          addLabel="Add button"
          items={header.buttons}
          max={MAX_BUTTONS}
          newItem={() => ({
            href: "",
            label: "",
            style: header.buttons.length === 0 ? "primary" : "secondary",
          })}
          onChange={(buttons) => onPatch("buttons", buttons)}
          renderItem={(button, update) => (
            <ButtonFields button={button} onChange={update} />
          )}
          title={(button, i) => button.label || `Button ${i + 1}`}
        />
      </InspSection>

      <InspSection label="Media">
        <MediaPicker
          onClear={() => onPatch("media", undefined)}
          onPicked={(fileId, src, mime) =>
            onPatch(
              "media",
              withAlt({ fileId, kind: kindOf(src, mime), src }, media?.alt)
            )
          }
          onUrl={(src) =>
            onPatch("media", withAlt({ kind: kindOf(src), src }, media?.alt))
          }
          src={media?.src}
        />
        {media ? (
          <InspRow label="Alt text">
            <input
              aria-label="Alt text"
              onChange={(e) => onPatch("media.alt", e.target.value)}
              placeholder={
                media.kind === "video"
                  ? "What the video shows"
                  : "What the photo shows"
              }
              value={media.alt ?? ""}
            />
          </InspRow>
        ) : null}
        {media?.kind === "video" ? (
          <p className="pe-insp-note">Plays as a muted loop.</p>
        ) : null}
        {media && header.variant === "plain" ? (
          <p className="pe-insp-note">
            Plain shows no media. Choose Split or Full to show it.
          </p>
        ) : null}
      </InspSection>

      {media?.kind === "video" ? (
        <InspSection label="Poster image">
          <MediaPicker
            accept="image/*"
            onClear={() => onPatch("media", withoutPoster(media))}
            onPicked={(fileId, src) =>
              onPatch("media", { ...media, poster: src, posterFileId: fileId })
            }
            onUrl={(src) =>
              onPatch("media", { ...withoutPoster(media), poster: src })
            }
            src={media.poster}
          />
          <p className="pe-insp-note">
            Shown before the video plays, and instead of it for visitors who
            reduce motion.
          </p>
        </InspSection>
      ) : null}

      <InspSection label="Actions">
        <div className="pe-insp-actions">
          <button onClick={onRemove} type="button">
            Remove page header
          </button>
        </div>
      </InspSection>
    </>
  );
}
