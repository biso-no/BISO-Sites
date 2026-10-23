import type { CSSProperties } from "react";
import type { FrameRatio } from "@/editor/types";
import { ratioValue, sizedImageSrc } from "./media";
import { MediaPlaceholder } from "./media-placeholder";

interface ChevronMediaProps {
  alt?: string;
  kind?: "image" | "video";
  lean?: "left" | "right";
  loop?: boolean;
  poster?: string;
  ratio: FrameRatio;
  src: string;
  width?: number;
}

const DEFAULT_WIDTH = 1200;

export function ChevronMedia({
  alt = "",
  kind = "image",
  lean = "left",
  loop = false,
  poster,
  ratio,
  src,
  width = DEFAULT_WIDTH,
}: ChevronMediaProps) {
  if (!src) {
    return (
      <MediaPlaceholder label="Add media in the inspector" ratio={ratio} />
    );
  }
  const posterSrc = poster ? sizedImageSrc(poster, width) : undefined;
  let child: React.ReactNode;
  if (kind === "video" && loop) {
    child = (
      <>
        <video
          autoPlay
          className="pg-reduced-motion-video"
          loop
          muted
          playsInline
          poster={posterSrc}
          src={src}
        />
        {posterSrc ? (
          // biome-ignore lint/correctness/useImageSize: fills the chevron frame.
          <img
            alt={alt}
            className="pg-reduced-motion-poster"
            decoding="async"
            loading="lazy"
            src={posterSrc}
          />
        ) : null}
      </>
    );
  } else if (kind === "video") {
    child = (
      <video controls poster={posterSrc} src={src}>
        <track kind="captions" label="Captions" />
      </video>
    );
  } else {
    child = (
      // biome-ignore lint/correctness/useImageSize: fills the chevron frame.
      <img
        alt={alt}
        decoding="async"
        loading="lazy"
        src={sizedImageSrc(src, width)}
      />
    );
  }
  return (
    <div
      className="chevron-frame"
      data-lean={lean === "right" ? "right" : undefined}
      style={{ "--ar": ratioValue(ratio) } as CSSProperties}
    >
      {child}
    </div>
  );
}
