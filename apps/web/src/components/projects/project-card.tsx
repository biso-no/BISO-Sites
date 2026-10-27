import { cn } from "@repo/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { paletteBackground } from "@/components/projects/project-palette";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { Pill } from "@/components/ui/pill";

interface ProjectCardProps {
  badge: string;
  ctaLabel: string;
  description: string;
  formattedDate?: string;
  href: string;
  /**
   * The project's own palette, from its `large_event` row — `gradientHex`, or
   * its primary and secondary colours. `null` when the row carries none, which
   * today is every project (PLACEHOLDER-011): no stand-in colour is drawn.
   */
  palette: string[] | null;
  title: string;
  variant: "featured" | "schedule";
}

/**
 * One project on `/projects` — the featured grid and the schedule share it.
 *
 * Bordered, not shadowed, and no hover lift (spec §1.8, §1.9). When a project
 * row supplies its own colours, the chevron frame carries them: spec §7.4's
 * "container for identity", which lets a flagship keep its palette inside
 * BISO's frame instead of repainting the card.
 */
export function ProjectCard({
  badge,
  ctaLabel,
  description,
  formattedDate,
  href,
  palette,
  title,
  variant,
}: ProjectCardProps) {
  const isFeatured = variant === "featured";

  return (
    <Link
      className="group flex h-full flex-col rounded-biso-md border border-edge p-6 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      href={href}
    >
      {palette && palette.length > 0 ? (
        <ChevronFrame className="mb-5" ratio="21/9">
          <span
            aria-hidden="true"
            className="block size-full"
            style={{ background: paletteBackground(palette) }}
          />
        </ChevronFrame>
      ) : null}

      <span className="flex">
        <Pill tone="accent" uppercase>
          {badge}
        </Pill>
      </span>

      <h3
        className={cn(
          "mt-3 break-words text-ink group-hover:text-ink-accent",
          isFeatured ? "type-display-sm" : "type-heading-card"
        )}
      >
        {title}
      </h3>

      <p className="type-body-sm mt-2 line-clamp-3 text-ink-muted">
        {description}
      </p>

      <span className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="type-data text-ink-muted">{formattedDate ?? ""}</span>
        <span className="type-label inline-flex items-center gap-1 text-ink-accent">
          {ctaLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      </span>
    </Link>
  );
}
