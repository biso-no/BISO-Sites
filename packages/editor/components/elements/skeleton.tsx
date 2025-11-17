import { cn } from "@repo/ui/lib/utils";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import type { SkeletonElementProps } from "../../types";

export function SkeletonElement({
  id,
  variant = "rectangular",
  width = "100%",
  height = "20px",
}: SkeletonElementProps) {
  return (
    <Skeleton
      id={id}
      className={cn(
        variant === "circular" && "rounded-full",
        variant === "text" && "h-4"
      )}
      style={{ width, height: variant === "circular" ? width : height }}
    />
  );
}

