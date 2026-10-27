"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ChevronMedia,
  embedSrc,
  isEmbedUrl,
  MediaPlaceholder,
  ratioValue,
  safeHref,
} from "@/blocks/_v2";
import { knownKey } from "@/blocks/_v2/known-key";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import { usePageFeedSource } from "@/editor/page-feed-context";
import type { VideoBlock } from "@/editor/types";

interface Props {
  block: VideoBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const POSTER_WIDTH = 1600;
const PROMPT = "Select a video in the inspector";
const PLAY_LABEL = { en: "Play video", no: "Spill av video" } as const;
const PLAYER_ALLOW = "autoplay; fullscreen; picture-in-picture";
const PLAY_BUTTON =
  "absolute top-1/2 left-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-biso-pill bg-action text-action-ink focus-visible:ring-2 focus-visible:ring-focus-ring";
/** A player fills its box; a file letterboxes rather than crop its frame. */
const EMBED_FILL = "absolute inset-0 size-full border-0";
const VIDEO_FILL = "absolute inset-0 size-full object-contain";
/** Unclipped: the chevron's cut would take the corners off the controls. */
const PLAYER_BOX = "relative overflow-hidden rounded-biso-md bg-deep";
const STYLES: Record<VideoBlock["style"], true> = {
  featured: true,
  inline: true,
  loop: true,
};

type Ratio = VideoBlock["ratio"];

/**
 * The style the block plays as. A muted loop needs a file a `<video>` can
 * play, so a YouTube or Vimeo link set to Loop plays as Featured; an unknown
 * style (copilot output) does too.
 */
export function videoStyleFor(
  block: Pick<VideoBlock, "style" | "url">
): VideoBlock["style"] {
  const style = knownKey(STYLES, block.style, "featured");
  return style === "loop" && isEmbedUrl(block.url ?? "") ? "featured" : style;
}

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-8"
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function Player({
  autoPlay,
  poster,
  title,
  url,
}: {
  autoPlay: boolean;
  poster?: string;
  title: string;
  url: string;
}) {
  const embed = embedSrc(url, { autoplay: autoPlay });
  if (embed) {
    return (
      <iframe
        allow={PLAYER_ALLOW}
        className={EMBED_FILL}
        // An inline player waits until it is near the viewport; a featured
        // one is loaded by the visitor's click, so it is wanted now.
        loading={autoPlay ? undefined : "lazy"}
        src={embed}
        title={title}
      />
    );
  }
  if (autoPlay) {
    return (
      // biome-ignore lint/a11y/useMediaCaption: editor-supplied footage has no caption track.
      <video autoPlay className={VIDEO_FILL} controls playsInline src={url} />
    );
  }
  return (
    // biome-ignore lint/a11y/useMediaCaption: editor-supplied footage has no caption track.
    <video
      className={VIDEO_FILL}
      controls
      poster={poster}
      preload="metadata"
      src={url}
    />
  );
}

/** The box a playing featured video sits in: its ratio, without the cut. */
function PlayerBox({
  ratio,
  title,
  url,
}: {
  ratio: Ratio;
  title: string;
  url: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  // The button that had focus is gone; keyboard and screen reader users
  // continue in the player that replaced it.
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("iframe, video")?.focus();
  }, []);
  return (
    <div
      className={PLAYER_BOX}
      ref={box}
      style={{ aspectRatio: `1 / ${ratioValue(ratio)}` } as CSSProperties}
    >
      <Player autoPlay title={title} url={url} />
    </div>
  );
}

function Featured({
  edit,
  label,
  poster,
  posterMime,
  ratio,
  title,
  url,
}: {
  edit: boolean;
  label?: string;
  poster?: string;
  posterMime?: string;
  ratio: Ratio;
  title: string;
  url: string;
}) {
  const { locale } = usePageFeedSource();
  const [playing, setPlaying] = useState(false);
  const playLabel = locale === "en" ? PLAY_LABEL.en : PLAY_LABEL.no;
  if (playing && !edit) {
    return <PlayerBox ratio={ratio} title={title} url={url} />;
  }
  const button = (
    <button
      aria-hidden={edit ? true : undefined}
      aria-label={playLabel}
      className={edit ? `pointer-events-none ${PLAY_BUTTON}` : PLAY_BUTTON}
      onClick={edit ? undefined : () => setPlaying(true)}
      tabIndex={edit ? -1 : undefined}
      type="button"
    >
      <PlayIcon />
    </button>
  );
  const pill = label ? (
    <span className="type-label absolute bottom-4 left-4 rounded-biso-pill bg-surface px-3 py-1 text-ink">
      {label}
    </span>
  ) : null;
  if (!poster) {
    return (
      <div
        className="chevron-frame bg-deep"
        style={{ "--ar": ratioValue(ratio) } as CSSProperties}
      >
        {button}
        {pill}
      </div>
    );
  }
  return (
    <div className="relative">
      <ChevronMedia
        alt=""
        mime={posterMime}
        ratio={ratio}
        src={poster}
        width={POSTER_WIDTH}
      />
      {button}
      {pill}
    </div>
  );
}

function VideoBody({
  block,
  edit,
  poster,
  url,
}: {
  block: VideoBlock;
  edit: boolean;
  poster?: string;
  url: string;
}) {
  const ratio = block.ratio ?? "16/9";
  const style = videoStyleFor({ style: block.style, url });
  const title = block.caption || block.label || "Video";
  if (style === "loop") {
    return (
      <ChevronMedia
        kind="video"
        loop
        poster={poster}
        posterMime={block.posterMime}
        ratio={ratio}
        src={url}
        width={POSTER_WIDTH}
      />
    );
  }
  if (style === "inline") {
    return (
      <div
        className={PLAYER_BOX}
        style={{ aspectRatio: `1 / ${ratioValue(ratio)}` } as CSSProperties}
      >
        <Player autoPlay={false} poster={poster} title={title} url={url} />
      </div>
    );
  }
  return (
    <Featured
      edit={edit}
      label={block.label}
      poster={poster}
      posterMime={block.posterMime}
      ratio={ratio}
      title={title}
      url={url}
    />
  );
}

export function VideoRender({ block, edit, onPatch }: Props) {
  const url = safeHref(block.url);
  if (!url) {
    return edit ? (
      <MediaPlaceholder label={PROMPT} ratio={block.ratio ?? "16/9"} />
    ) : null;
  }
  const rawPoster = safeHref(block.poster);
  return (
    <figure className="m-0">
      <VideoBody
        block={block}
        edit={edit}
        poster={rawPoster ?? undefined}
        url={url}
      />
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
