"use client";

import { useEffect, useState } from "react";

export interface TargetRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

/**
 * Tracks a target element's viewport-relative rect, re-measuring on scroll
 * (capture phase, so it catches scrolling inside any container), resize, and
 * element resize. Returns `null` when there is no element.
 */
export function useTargetRect(element: HTMLElement | null): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (!element) {
      setRect(null);
      return;
    }

    const update = () => {
      const next = element.getBoundingClientRect();
      setRect({
        top: next.top,
        left: next.left,
        width: next.width,
        height: next.height,
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      resizeObserver.disconnect();
    };
  }, [element]);

  return rect;
}
