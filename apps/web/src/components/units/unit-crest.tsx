import { ImageWithFallback } from "@repo/ui/components/image";
import { cn } from "@repo/ui/lib/utils";
import type { PublicUnit } from "@/lib/data/units";
import { unitMonogram } from "@/lib/unit-monogram";

interface UnitCrestProps {
  /** Sizing and spacing for the tile, e.g. `size-14`. */
  className?: string;
  /** Rendered pixel size, for the image request. */
  size?: number;
  unit: Pick<PublicUnit, "graphName" | "logoUrl" | "name">;
}

const DEFAULT_SIZE = 56;

/**
 * A unit's square tile: its logo filling the whole tile, or — while it has
 * none — a monogram on a colour derived from its name. A logo is scaled to
 * fit, never cropped, so a wide wordmark stays readable.
 *
 * Drawn in the redesign's terms — the `md` radius, no shadow — so it sits in a
 * bordered v2 card rather than floating above it.
 */
export function UnitCrest({
  className,
  size = DEFAULT_SIZE,
  unit,
}: UnitCrestProps) {
  if (unit.logoUrl) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          // A mid-tone neutral plate for transparent logos — neither white nor
          // the page's own surface. Units upload white marks and dark ones,
          // and only a mid tone keeps both readable: on white (or the
          // near-white sunken surface) the former vanishes. `ink-muted` at 30%
          // is that tone on paper and a mid slate on navy. Opaque logos cover
          // it entirely.
          "flex shrink-0 overflow-hidden rounded-biso-md bg-ink-muted/30",
          className
        )}
      >
        <ImageWithFallback
          alt=""
          className="h-full w-full object-contain"
          height={size}
          src={unit.logoUrl}
          width={size}
        />
      </span>
    );
  }

  // The monogram's hue is fixed per unit and dark enough for white text at
  // every hue (see `unit-monogram.ts`), so the letters do not follow the
  // surface the way a token would.
  const crest = unitMonogram(unit.name, unit.graphName);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-biso-md font-bold text-white",
        className
      )}
      style={{ background: crest.background }}
    >
      {crest.initials}
    </span>
  );
}
