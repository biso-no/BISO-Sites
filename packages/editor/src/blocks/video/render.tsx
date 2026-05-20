"use client";

import type { PatchFn } from "@/blocks/types";
import type { VideoBlock } from "@/editor/types";

interface Props {
  block: VideoBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const VIMEO_RE = /vimeo\.com\/(\d+)/;
const YOUTUBE_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;

function getEmbedUrl(url: string): string | null {
  const ytMatch = url.match(YOUTUBE_RE);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  const vimeoMatch = url.match(VIMEO_RE);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return null;
}

export function VideoRender({ block, edit }: Props) {
  const embedUrl = block.url ? getEmbedUrl(block.url) : null;
  const isNativeVideo = block.url && !embedUrl;
  let videoContent: React.ReactNode;

  if (embedUrl) {
    videoContent = (
      <iframe
        allow="autoplay; fullscreen"
        src={embedUrl}
        title={block.caption || "Video"}
      />
    );
  } else if (isNativeVideo) {
    videoContent = (
      <video
        controls
        src={block.url}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      >
        <track kind="captions" label={block.caption || "Captions"} />
      </video>
    );
  } else {
    videoContent = (
      <span
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,.4)",
          fontFamily: "var(--mono)",
        }}
      >
        {edit ? "Add a video URL in the inspector" : "No video"}
      </span>
    );
  }

  return (
    <div className="pg-video pg-block">
      <div className="pg-video__frame">{videoContent}</div>
      {block.caption && <p className="pg-video__caption">{block.caption}</p>}
    </div>
  );
}
