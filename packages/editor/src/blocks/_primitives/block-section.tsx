"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";
import type {
  BlockSpacing,
  BlockWidth,
  ResolvedBackground,
} from "./layout-types";

/**
 * Each painted surface rebinds semantic tokens for its descendants. Shared UI
 * components can therefore adapt to brand and inverted sections without
 * learning page-editor variants.
 */
export const SURFACE: Record<ResolvedBackground, string> = {
  default: "bg-background",
  muted: "bg-section",
  brand:
    "bg-brand [--background:var(--brand)] [--foreground:var(--brand-foreground)] " +
    "[--card:color-mix(in_oklch,var(--brand-foreground)_12%,transparent)] " +
    "[--card-foreground:var(--brand-foreground)] " +
    "[--popover:var(--brand)] [--popover-foreground:var(--brand-foreground)] " +
    "[--primary:var(--brand-foreground)] [--primary-foreground:var(--brand)] " +
    "[--secondary:color-mix(in_oklch,var(--brand-foreground)_15%,transparent)] " +
    "[--secondary-foreground:var(--brand-foreground)] " +
    "[--muted:color-mix(in_oklch,var(--brand-foreground)_12%,transparent)] " +
    "[--muted-foreground:color-mix(in_oklch,var(--brand-foreground)_78%,transparent)] " +
    "[--accent:var(--brand-accent)] [--accent-foreground:var(--brand-dark)] " +
    "[--border:color-mix(in_oklch,var(--brand-foreground)_30%,transparent)] " +
    "[--input:color-mix(in_oklch,var(--brand-foreground)_30%,transparent)] " +
    "[--ring:var(--brand-foreground)]",
  inverted:
    "bg-inverted [--background:var(--inverted)] [--foreground:var(--inverted-foreground)] " +
    "[--card:color-mix(in_oklch,var(--inverted-foreground)_8%,transparent)] " +
    "[--card-foreground:var(--inverted-foreground)] " +
    "[--popover:var(--inverted)] [--popover-foreground:var(--inverted-foreground)] " +
    "[--primary:var(--brand)] [--primary-foreground:var(--brand-foreground)] " +
    "[--secondary:color-mix(in_oklch,var(--inverted-foreground)_12%,transparent)] " +
    "[--secondary-foreground:var(--inverted-foreground)] " +
    "[--muted:color-mix(in_oklch,var(--inverted-foreground)_10%,transparent)] " +
    "[--muted-foreground:var(--inverted-muted)] " +
    "[--accent:var(--brand-accent)] [--accent-foreground:var(--brand-dark)] " +
    "[--border:color-mix(in_oklch,var(--inverted-foreground)_18%,transparent)] " +
    "[--input:color-mix(in_oklch,var(--inverted-foreground)_18%,transparent)] " +
    "[--ring:var(--brand)]",
  accent: "bg-brand-accent-muted",
};

export const SPACING: Record<BlockSpacing, string> = {
  none: "py-0",
  compact: "py-8 sm:py-10 lg:py-12",
  normal: "py-12 sm:py-16 lg:py-24",
  spacious: "py-20 sm:py-28 lg:py-36",
};

export const WIDTH: Record<BlockWidth, string> = {
  prose: "max-w-3xl",
  content: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none px-0 sm:px-0 lg:px-0",
};

interface BlockSectionProps {
  background: ResolvedBackground;
  children: ReactNode;
  className?: string;
  spacing?: BlockSpacing;
  width?: BlockWidth;
}

export const BlockSection = ({
  background,
  children,
  className,
  spacing = "normal",
  width = "wide",
}: BlockSectionProps) => (
  <section
    className={cn(
      "relative text-foreground",
      SURFACE[background],
      SPACING[spacing]
    )}
  >
    <div
      className={cn("mx-auto px-4 sm:px-6 lg:px-8", WIDTH[width], className)}
    >
      {children}
    </div>
  </section>
);
