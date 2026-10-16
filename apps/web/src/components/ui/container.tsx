import { cn } from "@repo/ui/lib/utils";
import type { ElementType, ReactNode } from "react";

/**
 * The horizontal frame. One width scale, one gutter.
 *
 * Phase 0 found **176 hand-rolled `mx-auto max-w-*` wrappers across seven
 * different widths** (`max-w-7xl` 61x, `max-w-4xl` 51x, `max-w-2xl` 31x, and
 * four more) with the page gutter re-typed at each one. Every future page uses
 * this instead, so the site has a single measured edge.
 *
 * The gutter is 16px at the smallest viewport, which is what keeps content off
 * the edge at 320px.
 */
export type ContainerWidth = "default" | "wide" | "prose" | "full";

const WIDTH: Record<ContainerWidth, string> = {
  /* 1200px — the standard content column. */
  default: "max-w-biso",
  /* 1440px — hero and full-bleed bands that still need an outer bound. */
  wide: "max-w-biso-wide",
  /* ~72 rendered characters. See <Prose>. */
  prose: "max-w-(--measure)",
  /* No bound; the caller is handling width itself. Gutter still applies. */
  full: "",
};

export interface ContainerProps {
  /** Render as something other than a `<div>` — `section`, `header`, `ul`… */
  as?: ElementType;
  children: ReactNode;
  className?: string;
  width?: ContainerWidth;
}

export function Container({
  children,
  width = "default",
  as: Tag = "div",
  className,
}: ContainerProps) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        WIDTH[width],
        className
      )}
    >
      {children}
    </Tag>
  );
}
