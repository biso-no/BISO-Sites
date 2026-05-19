"use client";

import type { VideoBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: VideoBlock; edit: boolean; onPatch: PatchFn; }

function getEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

export function VideoRender({ block, edit, onPatch }: Props) {
  const embedUrl = block.url ? getEmbedUrl(block.url) : null;
  const isNativeVideo = block.url && !embedUrl;

  return (
    <div className="pg-video pg-block">
      <div className="pg-video__frame">
        {embedUrl ? (
          <iframe src={embedUrl} allow="autoplay; fullscreen" title={block.caption || "Video"} />
        ) : isNativeVideo ? (
          <video src={block.url} controls style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 13, color: "rgba(255,255,255,.4)", fontFamily: "var(--mono)" }}>
            {edit ? "Add a video URL in the inspector" : "No video"}
          </span>
        )}
      </div>
      {block.caption && (
        <p className="pg-video__caption">{block.caption}</p>
      )}
    </div>
  );
}
