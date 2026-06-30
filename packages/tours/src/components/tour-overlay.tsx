"use client";

import type { TargetRect } from "../lib/use-target-rect";

/** Dim colour for the page behind the tour. Intentionally dark in both themes. */
const DIM = "rgba(2, 6, 23, 0.6)";
const SPOTLIGHT_TRANSITION =
  "top 150ms ease, left 150ms ease, width 150ms ease, height 150ms ease";
/**
 * Sit above all app chrome. Set inline (not via a Tailwind class) so it never
 * depends on the host app's Tailwind `@source` config emitting the class.
 */
const OVERLAY_Z = 2_147_483_000;

interface TourOverlayProps {
  padding: number;
  /** Target rect to spotlight, or `null` for a full-screen dim (centered step). */
  rect: TargetRect | null;
  reducedMotion: boolean;
}

/**
 * Renders the dimming layer. When a rect is given, a transparent cut-out element
 * uses a huge box-shadow to dim everything except the target. A separate
 * full-screen layer swallows clicks so the page underneath stays non-interactive
 * during the walkthrough.
 */
export function TourOverlay({
  rect,
  padding,
  reducedMotion,
}: TourOverlayProps) {
  if (!rect) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{ backgroundColor: DIM, zIndex: OVERLAY_Z }}
      />
    );
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{ zIndex: OVERLAY_Z }}
      />
      <div
        aria-hidden="true"
        className="fixed rounded-lg"
        style={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          boxShadow: `0 0 0 9999px ${DIM}`,
          transition: reducedMotion ? undefined : SPOTLIGHT_TRANSITION,
          zIndex: OVERLAY_Z,
        }}
      />
    </>
  );
}
