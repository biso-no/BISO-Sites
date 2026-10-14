import { ImageWithFallback } from "@repo/ui/components/image";
import { cn } from "@repo/ui/lib/utils";
import type { PublicUnit } from "@/lib/data/units";
import { unitMonogram } from "@/lib/unit-monogram";

interface UnitCrestProps {
  /** Sizing and spacing for the tile, e.g. `h-14 w-14`. */
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
          // Neutral plate for transparent logos: light enough for a dark
          // mark, dark enough for a white one. Opaque logos cover it.
          "flex shrink-0 overflow-hidden rounded-2xl bg-slate-300 shadow-md",
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

  const crest = unitMonogram(unit.name, unit.graphName);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl font-semibold text-white shadow-md",
        className
      )}
      style={{ background: crest.background }}
    >
      {crest.initials}
    </span>
  );
}
