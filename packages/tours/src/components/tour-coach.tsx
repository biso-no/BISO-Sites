"use client";

import { MousePointer2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TourCoach as TourCoachSpec } from "../types";

const DRAG_DURATION_MS = 2600;
const MAX_RESOLVE_FRAMES = 90;
/** Between the overlay and the card. Inline so it never depends on Tailwind. */
const COACH_Z = 2_147_483_001;

interface Point {
  x: number;
  y: number;
}

function centerOf(selector: string): Point | null {
  const element = document.querySelector(selector);
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

interface TourCoachProps {
  coach: TourCoachSpec;
  reducedMotion: boolean;
}

/**
 * A decorative, looping demonstration layered over a step. For `drag`, a faux
 * cursor + ghost card travels from the `from` element to the `to` element. With
 * reduced motion it renders a static pointer at the source instead of animating.
 */
export function TourCoach({ coach, reducedMotion }: TourCoachProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<{ from: Point; to: Point } | null>(null);

  // Resolve both endpoints, retrying across a few frames for async layout.
  useEffect(() => {
    let frame = 0;
    let tries = 0;
    const resolve = () => {
      const from = centerOf(coach.from);
      const to = centerOf(coach.to);
      if (from && to) {
        setPoints({ from, to });
        return;
      }
      if (tries < MAX_RESOLVE_FRAMES) {
        tries += 1;
        frame = requestAnimationFrame(resolve);
      }
    };
    resolve();
    return () => cancelAnimationFrame(frame);
  }, [coach.from, coach.to]);

  useEffect(() => {
    if (!points || reducedMotion) {
      return;
    }
    const element = ref.current;
    if (!element) {
      return;
    }
    const { from, to } = points;
    const animation = element.animate(
      [
        {
          transform: `translate(${from.x}px, ${from.y}px) scale(1)`,
          offset: 0,
        },
        {
          transform: `translate(${from.x}px, ${from.y}px) scale(0.86)`,
          offset: 0.12,
        },
        {
          transform: `translate(${to.x}px, ${to.y}px) scale(0.86)`,
          offset: 0.62,
        },
        { transform: `translate(${to.x}px, ${to.y}px) scale(1)`, offset: 0.74 },
        { transform: `translate(${to.x}px, ${to.y}px) scale(1)`, offset: 1 },
      ],
      {
        duration: DRAG_DURATION_MS,
        iterations: Number.POSITIVE_INFINITY,
        easing: "ease-in-out",
      }
    );
    return () => animation.cancel();
  }, [points, reducedMotion]);

  if (!points) {
    return null;
  }

  const staticTransform = reducedMotion
    ? `translate(${points.from.x}px, ${points.from.y}px)`
    : undefined;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0"
      ref={ref}
      style={
        staticTransform
          ? { transform: staticTransform, zIndex: COACH_Z }
          : { zIndex: COACH_Z }
      }
    >
      <div className="relative -translate-x-1/2 -translate-y-1/2">
        <div className="flex flex-col gap-1 rounded-md border border-black/10 bg-white/95 px-2.5 py-2 shadow-xl">
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
          <span className="h-1.5 w-6 rounded-full bg-slate-200" />
        </div>
        <MousePointer2 className="absolute -right-2 -bottom-2 size-5 fill-white text-slate-900 drop-shadow-md" />
      </div>
    </div>
  );
}
