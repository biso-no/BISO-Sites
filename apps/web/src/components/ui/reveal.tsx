"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * The only sanctioned motion wrapper in the redesign.
 *
 * **It has no scroll trigger, deliberately.** The spec permits exactly three
 * kinds of motion: one orchestrated moment per page, motion that answers a user
 * action, and state transitions. Scroll-triggered reveals are none of those —
 * Phase 0 counted 115 `whileInView` uses, and the brief names that pattern as
 * the generic default it wants removed. `<Reveal>` therefore animates **on
 * mount only**, which serves the home hero's orchestrated entrance (RD-018) and
 * skeleton-to-content transitions, and cannot be misused to fade in every
 * section on scroll.
 *
 * Under `prefers-reduced-motion` it renders its children with **no wrapper
 * element at all** — not a motionless wrapper, no element. Nothing to animate,
 * nothing to inspect, no stray div in the tree.
 *
 * Motion in this app is also globally gated by `<MotionConfig reducedMotion="user">`
 * in app/providers.tsx; this component's own check makes it correct in
 * isolation and lets it skip the wrapper entirely.
 */

/** Milliseconds between successive items in an orchestrated sequence. */
const STAGGER_STEP_MS = 90;
const MS_PER_SECOND = 1000;

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Direction the content travels in from. `none` fades only. */
  from?: "below" | "left" | "right" | "none";
  /** Position in an orchestrated sequence. 0 is first, and delays from there. */
  index?: number;
  /** Render as a `<span>` for inline content. Defaults to `<div>`. */
  inline?: boolean;
}

const OFFSET = 16;

function offsetFor(from: RevealProps["from"]) {
  switch (from) {
    case "left":
      return { x: -OFFSET, y: 0 };
    case "right":
      return { x: OFFSET, y: 0 };
    case "below":
      return { x: 0, y: OFFSET };
    default:
      return { x: 0, y: 0 };
  }
}

export function Reveal({
  children,
  index = 0,
  from = "below",
  className,
  inline = false,
}: RevealProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <>{children}</>;
  }

  const offset = offsetFor(from);
  const Tag = inline ? motion.span : motion.div;

  return (
    <Tag
      animate={{ opacity: 1, x: 0, y: 0 }}
      className={className}
      initial={{ opacity: 0, ...offset }}
      transition={{
        duration: 0.32,
        delay: (index * STAGGER_STEP_MS) / MS_PER_SECOND,
        ease: [0.2, 0, 0, 1],
      }}
    >
      {children}
    </Tag>
  );
}
