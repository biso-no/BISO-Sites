"use client";

import type { PatchFn } from "@/blocks/types";
import type { VideoBlock } from "@/editor/types";
import { embedSrc } from "../_v2/media";

interface Props {
  block: VideoBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function VideoRender({ block, edit }: Props) {
  const embedUrl = block.url ? embedSrc(block.url) : null;
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
