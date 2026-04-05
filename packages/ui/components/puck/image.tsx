"use client";

import { cn } from "../../lib/utils";
import { ImageWithFallback } from "../image";

export type ImageProps = {
  src: string;
  alt: string;
  caption?: string;
  aspect?: "auto" | "video" | "square" | "portrait";
  rounded?: "none" | "md" | "lg";
  maxWidth?: "narrow" | "default" | "full";
  align?: "left" | "center";
};

export function Image({
  src,
  alt,
  caption,
  aspect = "auto",
  rounded = "md",
  maxWidth = "default",
  align = "center",
}: ImageProps) {
  const roundedClasses = {
    none: "rounded-none",
    md: "rounded-xl",
    lg: "rounded-2xl",
  } as const;

  const maxWidthClasses = {
    narrow: "max-w-3xl",
    default: "max-w-5xl",
    full: "max-w-none",
  } as const;

  const alignClasses = {
    left: "mr-auto",
    center: "mx-auto",
  } as const;

  const aspectClasses = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-3/4",
  } as const;

  const wrapperClassName = cn(
    "w-full",
    maxWidthClasses[maxWidth],
    alignClasses[align]
  );

  return (
    <figure className={wrapperClassName}>
      {aspect === "auto" ? (
        <ImageWithFallback
          alt={alt}
          className={cn("h-auto w-full object-cover", roundedClasses[rounded])}
          height={800}
          src={src}
          width={1200}
        />
      ) : (
        <div
          className={cn(
            "relative w-full overflow-hidden",
            aspectClasses[aspect],
            roundedClasses[rounded]
          )}
        >
          <ImageWithFallback
            alt={alt}
            className="object-cover"
            fill
            sizes="(max-width: 768px) 100vw, 900px"
            src={src}
          />
        </div>
      )}

      {caption && (
        <figcaption className="mt-3 text-center text-muted-foreground text-sm">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

