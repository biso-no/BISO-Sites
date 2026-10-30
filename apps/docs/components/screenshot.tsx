import Image from "next/image";

interface ScreenshotProps {
  alt: string;
  caption?: string;
  height: number;
  src: string;
  width: number;
}

/**
 * A screenshot in a plain 1px frame with square corners. Never cut at the
 * brand's 13° angle: the whole screen stays visible.
 */
export function Screenshot({
  src,
  alt,
  caption,
  width,
  height,
}: ScreenshotProps) {
  return (
    <figure className="not-prose my-6">
      <div className="border border-edge bg-surface-sunken">
        <Image
          alt={alt}
          className="block h-auto w-full"
          height={height}
          src={src}
          width={width}
        />
      </div>
      {caption ? (
        <figcaption className="mt-1 text-[12px] text-ink-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
