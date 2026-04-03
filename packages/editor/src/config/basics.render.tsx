import {
  ButtonRow,
  type ButtonRowProps,
} from "@repo/ui/components/puck/button-row";
import { Divider, type DividerProps } from "@repo/ui/components/puck/divider";
import { Heading, type HeadingProps } from "@repo/ui/components/puck/heading";
import {
  Image as PuckImage,
  type ImageProps as PuckImageProps,
} from "@repo/ui/components/puck/image";
import { Text, type TextProps } from "@repo/ui/components/puck/text";
import type { VideoEmbedProps } from "./types";

export function HeadingRender(props: HeadingProps) {
  return <Heading {...props} />;
}

export function TextRender(props: TextProps) {
  return <Text {...props} />;
}

export function ImageRender(props: PuckImageProps) {
  return <PuckImage {...props} />;
}

export function ButtonRowRender(props: ButtonRowProps) {
  return <ButtonRow {...props} />;
}

export function DividerRender(props: DividerProps) {
  return <Divider {...props} />;
}

export function VideoEmbedRender({
  url,
  aspect,
  caption,
  autoplay,
}: VideoEmbedProps) {
  const getEmbedUrl = (raw: string | undefined): string | null => {
    if (!raw) {
      return null;
    }
    const ytMatch = raw.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
    );
    if (ytMatch?.[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}${autoplay ? "?autoplay=1&mute=1" : ""}`;
    }
    const vimeoMatch = raw.match(/(?:vimeo\.com\/)(\d+)/);
    if (vimeoMatch?.[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}${autoplay ? "?autoplay=1&muted=1" : ""}`;
    }
    return raw;
  };

  const embedUrl = getEmbedUrl(url);
  const aspectClass =
    aspect === "4:3"
      ? "aspect-[4/3]"
      : aspect === "1:1"
        ? "aspect-square"
        : "aspect-video";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4">
      <div
        className={`relative w-full ${aspectClass} overflow-hidden rounded-xl bg-gray-100 shadow-md`}
      >
        {embedUrl ? (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
            src={embedUrl}
            title={caption || "Video"}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <svg
              className="mb-2 h-16 w-16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-sm">Paste a YouTube or Vimeo URL</span>
          </div>
        )}
      </div>
      {caption && (
        <p className="mt-3 text-center text-gray-500 text-sm">{caption}</p>
      )}
    </div>
  );
}
