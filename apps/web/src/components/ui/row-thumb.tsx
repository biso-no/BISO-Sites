import { ImageWithFallback } from "@repo/ui/components/image";
import { cn } from "@repo/ui/lib/utils";

/**
 * The small image on a compact feed row.
 *
 * The v1 campus page and homepage showed event and news pictures in their
 * preview lists; the redesign's card feeds kept them but the compact rows on
 * `/` and `/campus/<slug>` were rebuilt text-only, which read as a step
 * backwards from a page that used to be visual. This is that image at row
 * scale — small enough not to compete with the headline, present enough that
 * the list is not a wall of text.
 *
 * Renders nothing without a source, so a row with no picture keeps its
 * alignment instead of reserving an empty box.
 *
 * `alt=""` deliberately: the headline beside it is the accessible name, and
 * announcing a decorative thumbnail twice helps nobody.
 */
export function RowThumb({
  className,
  src,
}: {
  className?: string;
  src?: string | null;
}) {
  if (!src) {
    return null;
  }
  return (
    <span
      className={cn(
        "relative h-12 w-16 shrink-0 overflow-hidden rounded-biso-sm bg-surface-sunken sm:h-14 sm:w-24",
        className
      )}
    >
      {/* Fixed dimensions rather than `fill`: the box is 64/96 CSS px wide, so
          asking the optimizer for that width keeps a row of thumbnails to a few
          KB each instead of pulling a full-size original. `ImageWithFallback`
          swaps in a placeholder when a source 404s — several `media` rows point
          at files that no longer exist, and a broken-image icon reads worse
          than no image at all. */}
      <ImageWithFallback
        alt=""
        className="h-full w-full object-cover"
        height={112}
        sizes="(max-width: 640px) 64px, 96px"
        src={src}
        width={192}
      />
    </span>
  );
}
