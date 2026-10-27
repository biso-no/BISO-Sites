import { cn } from "@repo/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A section title, and — when the section leads somewhere — the link out.
 *
 * **The sun marker is load-bearing, not decoration.** The reference underlines
 * section headings with a hand-drawn yellow stroke. Applying it to every
 * heading would make it ornament; here it appears *only* when `seeAllHref` is
 * present, so the marker means "there is more behind this". A terminal
 * heading — "Highlights", "On this page" — gets none. Same visual, now
 * carrying information. See 01-design-spec.md §7.3.
 *
 * The marker is therefore not a style prop, and there is deliberately no way to
 * turn it on without a destination.
 */
export interface SectionHeadingProps {
  /** Heading level. Defaults to h2; use h3 for a nested section. */
  as?: "h2" | "h3";
  children: ReactNode;
  className?: string;
  id?: string;
  /** Destination for "see all". Presence of this is what draws the marker. */
  seeAllHref?: string;
  /** Visible label for the link. Required when `seeAllHref` is set. */
  seeAllLabel?: string;
}

export function SectionHeading({
  children,
  seeAllHref,
  seeAllLabel,
  as: Tag = "h2",
  id,
  className,
}: SectionHeadingProps) {
  const leadsSomewhere = Boolean(seeAllHref && seeAllLabel);

  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2",
        className
      )}
    >
      {/* `break-words`: Norwegian compounds ("rekrutteringskonsept",
          "Arrangementskalender") are single words wider than a 320px column at
          display sizes, and a heading is the largest type on the page — the
          place it shows first. Caught on /business at 320px; the same fix in
          <Prose> covers authored headings. */}
      <Tag
        className="type-heading-section min-w-0 break-words text-ink"
        id={id}
      >
        <span
          className={cn(
            leadsSomewhere &&
              // 3px sun stroke under the first line only, sitting behind the
              // text rather than underlining it.
              //
              // Drawn on a pseudo-element rather than as the span's own
              // `background-image`. RD-031: as a background it made the marker
              // colour the text's background, and axe scored white-on-#fecd45
              // at **1.49:1** on every deep band that carries a section
              // heading. The stroke is the same 3px bar in the same place; the
              // text now sits on the section's own surface, which is what it
              // visually does anyway.
              "relative pb-1 after:absolute after:inset-x-0 after:bottom-0 after:-z-10 after:h-[3px] after:bg-marker after:content-['']"
          )}
          data-marker={leadsSomewhere ? "true" : undefined}
        >
          {children}
        </span>
      </Tag>

      {leadsSomewhere && seeAllHref && (
        <Link
          className="type-body-sm inline-flex items-center gap-1 text-ink-accent underline-offset-4 hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
          href={seeAllHref}
        >
          {seeAllLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </div>
  );
}
