"use client";

import { useReducedMotion } from "motion/react";
import { useState } from "react";
import { Reveal } from "@/components/ui/reveal";

/**
 * Demonstrates the motion floor and lets it be re-triggered without a reload,
 * because a mount-only animation is otherwise impossible to inspect.
 */
export function MotionDemo() {
  const [run, setRun] = useState(0);
  const prefersReduced = useReducedMotion();

  return (
    <div>
      <p
        className="type-body-sm mb-4 rounded-biso-md border border-edge p-4"
        data-reduced-motion={prefersReduced ? "reduce" : "no-preference"}
      >
        This browser reports{" "}
        <strong>
          prefers-reduced-motion: {prefersReduced ? "reduce" : "no-preference"}
        </strong>
        .{" "}
        {prefersReduced
          ? "Reveal is rendering its children with no wrapper element, and every CSS transition is capped at 1ms."
          : "Reveal is animating on mount. Turn the OS setting on and reload to see it stand down."}
      </p>

      <button
        className="type-label rounded-biso-pill bg-action px-4 py-2 text-action-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
        onClick={() => setRun((n) => n + 1)}
        type="button"
      >
        Replay sequence
      </button>

      <ul className="mt-5 grid gap-3 sm:grid-cols-4" key={run}>
        {["First", "Second", "Third", "Fourth"].map((label, i) => (
          <li key={label}>
            <Reveal index={i}>
              <span className="type-data block rounded-biso-md border border-edge bg-surface-raised p-4">
                {label}
              </span>
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  );
}
