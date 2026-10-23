import { cn } from "@repo/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { UnitCrest } from "@/components/units/unit-crest";
import type { PublicUnit } from "@/lib/data/units";

/**
 * One unit as a card: its crest (logo filling the tile, or the name-derived
 * monogram while it has none), name, campus, teaser and category.
 *
 * Shared by `/units`, the campus landings and the front page's unit grid so a
 * unit looks the same everywhere it is listed. Deliberately hook-free and
 * free of server-only imports — labels arrive translated — so a Server
 * Component grid and a client "load more" island render identical markup.
 *
 * Bordered, not shadowed, and no hover lift (spec §1.8, §1.9): the hover is a
 * colour change on the name and the arrow, which is a response to the pointer
 * rather than motion for its own sake.
 */
export interface UnitCardLabels {
  /** Translated category name, or null when the unit has none. */
  category: string | null;
  /** Shown in place of a missing teaser. */
  noSummary: string;
}

export interface UnitCardProps {
  className?: string;
  /** Heading level for the unit name inside its grid. Defaults to h3. */
  headingLevel?: "h2" | "h3" | "h4";
  labels: UnitCardLabels;
  /** Show the campus line. Off when the surrounding list is one campus. */
  showCampus?: boolean;
  unit: Pick<
    PublicUnit,
    "campusLabel" | "graphName" | "href" | "id" | "logoUrl" | "name" | "summary"
  >;
}

export function UnitCard({
  className,
  headingLevel: Heading = "h3",
  labels,
  showCampus = true,
  unit,
}: UnitCardProps) {
  return (
    <Link
      className={cn(
        "group flex h-full flex-col rounded-biso-md border border-edge bg-surface-raised p-5 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className
      )}
      href={unit.href}
    >
      {/* Block wrappers, not spans: a heading is not phrasing content, so it
          cannot sit inside a <span> even though the <a> around it allows it. */}
      <div className="flex items-start gap-4">
        <UnitCrest className="size-14 text-lg" unit={unit} />
        <div className="min-w-0 flex-1">
          {/* `break-words`: Norwegian unit names are long unbroken compounds
              and a grid track would otherwise widen to fit the longest. */}
          <Heading className="type-heading-card break-words text-ink group-hover:text-ink-accent">
            {unit.name}
          </Heading>
          {showCampus && unit.campusLabel ? (
            <span className="type-label mt-1 block text-ink-muted">
              {unit.campusLabel}
            </span>
          ) : null}
        </div>
        <ArrowRight
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>

      <p className="type-body-sm mt-4 line-clamp-3 text-ink-muted">
        {unit.summary ?? labels.noSummary}
      </p>

      {labels.category ? (
        <div className="mt-auto pt-4">
          <Pill tone="accent" uppercase>
            {labels.category}
          </Pill>
        </div>
      ) : null}
    </Link>
  );
}
