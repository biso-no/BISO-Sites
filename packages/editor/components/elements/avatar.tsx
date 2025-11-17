import { cn } from "@repo/ui/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { getStorageFileUrl } from "@repo/api/storage";
import type { AvatarElementProps } from "../../types";

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
};

export function AvatarElement({
  id,
  image,
  fallback,
  size = "md",
}: AvatarElementProps) {
  const imageUrl = image?.type === "upload" && image.fileId
    ? getStorageFileUrl("content", image.fileId)
    : image?.url;

  return (
    <div id={id}>
      <Avatar className={cn(sizeMap[size])}>
        {imageUrl && <AvatarImage src={imageUrl} alt={fallback} />}
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
    </div>
  );
}

