import { cn } from "@repo/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";

/**
 * The signature element — a media frame whose vertical edges lean 13°.
 *
 * The angle is measured from the reference design and is the one angle in the
 * whole system. It is not decoration: per `01-design-spec.md` §7.4 the frame is
 * a container for identity — on home and campus pages the panels show *that
 * campus*, and on `/projects/[slug]` the same frame accepts the project's own
 * palette. Using it as generic image styling would make it wallpaper.
 *
 * Geometry: a `clip-path` x-percentage resolves against width while the angle
 * depends on height, so the cut is derived from the aspect ratio rather than
 * hardcoded — `cut = 0.2309 × (height/width)`. One number (`--ar`) drives both
 * `aspect-ratio` and the cut, so the frame and its angle cannot drift apart.
 */
export type ChevronRatio =
  | "21/9"
  | "16/9"
  | "3/2"
  | "4/3"
  | "1/1"
  | "4/5"
  | "3/4";

/** height / width for each supported ratio. */
const ASPECT: Record<ChevronRatio, number> = {
  "21/9": 9 / 21,
  "16/9": 9 / 16,
  "3/2": 2 / 3,
  "4/3": 3 / 4,
  "1/1": 1,
  "4/5": 5 / 4,
  "3/4": 4 / 3,
};

export interface ChevronFrameProps {
  /** Optional: the frame is also useful as a bare shape with a background. */
  children?: ReactNode;
  className?: string;
  id?: string;
  /** `left` is the leading edge; `right` is the return edge for a collage. */
  lean?: "left" | "right";
  ratio?: ChevronRatio;
}

export function ChevronFrame({
  children,
  ratio = "16/9",
  lean = "left",
  className,
  id,
}: ChevronFrameProps) {
  return (
    <div
      className={cn("chevron-frame", className)}
      data-lean={lean === "right" ? "right" : undefined}
      data-ratio={ratio}
      id={id}
      style={{ "--ar": ASPECT[ratio] } as CSSProperties}
    >
      {children}
    </div>
  );
}
