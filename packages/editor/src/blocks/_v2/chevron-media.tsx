import type { CSSProperties } from "react";
import type { FrameRatio } from "@/editor/types";
import { ratioValue, sizedImageSrc } from "./media";
import { MediaPlaceholder } from "./media-placeholder";

interface ChevronMediaProps {
  alt?: string;
  /** Extra classes on the frame, e.g. to let a grid size it. */
  className?: string;
  /** Extra classes on the image, e.g. `object-contain` for a logo. */
  imageClassName?: string;
  kind?: "image" | "video";
  lean?: "left" | "right";
  /** "eager" for media above the fold (a page header's); lazy otherwise. */
  loading?: "lazy" | "eager";
  loop?: boolean;
  /** The image's uploaded type: an SVG or GIF is shown unresized. */
  mime?: string;
  /** Editor-only prompt for an empty `src`; blocks pass it only in edit mode. */
  placeholder?: string;
  poster?: string;
  /** The poster's uploaded type, as `mime`. */
  posterMime?: string;
  ratio: FrameRatio;
  src: string;
  width?: number;
}

const DEFAULT_WIDTH = 1200;

export function ChevronMedia({
  alt = "",
  className,
  imageClassName,
  kind = "image",
  lean = "left",
  loading = "lazy",
  loop = false,
  mime,
  placeholder,
  poster,
  posterMime,
  ratio,
  src,
  width = DEFAULT_WIDTH,
}: ChevronMediaProps) {
  if (!src) {
    return <MediaPlaceholder label={placeholder} ratio={ratio} />;
  }
  const posterSrc = poster
    ? sizedImageSrc(poster, width, posterMime)
    : undefined;
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
            loading={loading}
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
        className={imageClassName}
        decoding="async"
        loading={loading}
        src={sizedImageSrc(src, width, mime)}
      />
    );
  }
  return (
    <div
      className={className ? `chevron-frame ${className}` : "chevron-frame"}
      data-lean={lean === "right" ? "right" : undefined}
      style={{ "--ar": ratioValue(ratio) } as CSSProperties}
    >
      {child}
    </div>
  );
}
