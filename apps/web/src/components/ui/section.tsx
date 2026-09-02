import { cn } from "@repo/ui/lib/utils";
import type { ElementType, ReactNode } from "react";
import { Container, type ContainerWidth } from "./container";

/**
 * The vertical frame: rhythm, surface, and clearance for the fixed header.
 *
 * Phase 0 found **four competing section rhythms** (`py-16` 85x, `py-12` 34x,
 * `py-24` 11x, `py-20` 7x), **50 `min-h-screen` wrappers**, and — worst —
 * **four different `pt-*` values** (`pt-20`, `pt-28`, `pt-32`, `pt-36`) each
 * hand-compensating for the same fixed 80px nav. That last one is a bug
 * surface, not just inconsistency: get it wrong and content hides behind the
 * header.
 *
 * `clearNav` owns that offset now. A hero deliberately does not set it — the
 * nav is transparent over the hero by design, so the hero runs underneath it.
 * Every other first-on-page section does set it.
 */
export type SectionTone = "paper" | "deep" | "none";
export type SectionRhythm = "base" | "lg" | "none";

/** Matches the fixed nav's `h-20`. */
const NAV_HEIGHT = "5rem";

/** Vertical rhythm. Two values, replacing the four Phase 0 found in use. */
const RHYTHM: Record<SectionRhythm, string | undefined> = {
  base: "var(--section-y)",
  lg: "var(--section-y-lg)",
  none: undefined,
};

const TONE: Record<SectionTone, string> = {
  paper: "bg-surface text-ink",
  deep: "bg-surface text-ink",
  none: "",
};

export interface SectionProps {
  "aria-labelledby"?: string;
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** Add clearance for the fixed header. Set on the first section of a page. */
  clearNav?: boolean;
  id?: string;
  rhythm?: SectionRhythm;
  tone?: SectionTone;
  /** Omit to render children unwrapped, e.g. for a custom inner grid. */
  width?: ContainerWidth | "none";
}

export function Section({
  children,
  tone = "none",
  rhythm = "base",
  clearNav = false,
  width = "default",
  as: Tag = "section",
  className,
  id,
  "aria-labelledby": labelledBy,
}: SectionProps) {
  const padY = RHYTHM[rhythm];

  // The nav is transparent until scrolled and is always `data-surface="deep"`,
  // so its controls are white. Over a `deep` first section that is the intended
  // look; over a `paper` one in light theme it was **white on white** — the
  // campus pill, the menu and the cart measured 1:1 against the page behind
  // them. Painting the nav's own height in the deep colour gives those controls
  // the surface they are drawn for, and reads as the solid header the scrolled
  // state already shows. Only a section that both clears the nav and is paper
  // sits under it, so nothing else is affected.
  const backdropNeeded = clearNav && tone === "paper";

  return (
    <Tag
      aria-labelledby={labelledBy}
      className={cn(TONE[tone], backdropNeeded && "relative", className)}
      // `data-surface` flips the semantic aliases (--ink, --action, --edge) to
      // their on-navy values, so children never branch on surface themselves.
      data-surface={tone === "deep" ? "deep" : undefined}
      id={id}
      style={{
        paddingBlock: padY,
        paddingBlockStart: clearNav
          ? `calc(${NAV_HEIGHT} + ${padY ?? "0px"})`
          : padY,
      }}
    >
      {backdropNeeded ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 bg-deep"
          style={{ height: NAV_HEIGHT }}
        />
      ) : null}
      {width === "none" ? (
        children
      ) : (
        <Container width={width}>{children}</Container>
      )}
    </Tag>
  );
}
