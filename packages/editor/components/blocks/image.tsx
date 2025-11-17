import { cn } from "@repo/ui/lib/utils";
import { getStorageFileUrl } from "@repo/api/storage";
import type { ImageBlockProps, AspectRatio, ImageBorder, Shadow } from "../../types";

const aspectRatioMap: Record<AspectRatio, string> = {
  auto: "aspect-auto",
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[21/9]",
  portrait: "aspect-[3/4]",
};

const borderMap: Record<ImageBorder, string> = {
  none: "border-0",
  sm: "border",
  md: "border-2",
  lg: "border-4",
};

const shadowMap: Record<Shadow, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
};

export function Image({
  id,
  image,
  caption,
  aspectRatio = "auto",
  border = "none",
  shadow = "none",
  rounded = false,
}: ImageBlockProps) {
  const imageUrl = image.type === "upload" && image.fileId
    ? getStorageFileUrl("content", image.fileId)
    : image.url;

  if (!imageUrl) {
    return (
      <div
        id={id}
        className="flex items-center justify-center bg-gray-100 text-gray-400 p-12 rounded-lg"
      >
        No image selected
      </div>
    );
  }

  return (
    <figure id={id} className="space-y-3">
      <div
        className={cn(
          "relative overflow-hidden",
          aspectRatioMap[aspectRatio],
          borderMap[border],
          shadowMap[shadow],
          rounded && "rounded-lg",
          border !== "none" && "border-gray-200"
        )}
      >
        <img
          src={imageUrl}
          alt={image.alt || caption || ""}
          className="h-full w-full object-cover"
        />
      </div>
      {caption && (
        <figcaption className="text-center text-sm text-gray-600">{caption}</figcaption>
      )}
    </figure>
  );
}

