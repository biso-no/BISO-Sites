import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const providers = readFileSync(
  join(import.meta.dirname, "providers.tsx"),
  "utf8"
);
const styles = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
const reveal = readFileSync(
  join(import.meta.dirname, "../components/ui/reveal.tsx"),
  "utf8"
);

const REDUCED_MOTION_QUERY = /@media\s*\(prefers-reduced-motion:\s*reduce\)/;
const revealCode = codeOnly(reveal);

describe("reduced-motion floor (RD-008)", () => {
  it("gates every motion component through MotionConfig", () => {
    // This is the ONLY lever that reaches motion/react: it animates through
    // WAAPI and inline styles, so the CSS block below cannot stop it. Phase 0
    // counted 161 fade-and-slide-ups across 99 files; removing this provider
    // silently un-fixes all of them.
    expect(providers).toContain("MotionConfig");
    expect(providers).toContain('reducedMotion="user"');
  });

  it("caps CSS-driven animation and transition", () => {
    // Covers tw-animate-css, the accordion keyframes in packages/ui, and every
    // hover/focus transition — none of which motion/react touches.
    expect(styles).toMatch(REDUCED_MOTION_QUERY);
    expect(styles).toContain("animation-duration: 1ms !important");
    expect(styles).toContain("transition-duration: 1ms !important");
    expect(styles).toContain("animation-iteration-count: 1 !important");
  });

  it("keeps 1ms rather than 0s so end-event listeners still fire", () => {
    expect(styles).not.toContain("transition-duration: 0s !important");
  });

  it("makes Reveal render no wrapper element under reduced motion", () => {
    expect(reveal).toContain("useReducedMotion");
    expect(reveal).toContain("return <>{children}</>");
  });

  it("keeps Reveal free of any scroll trigger", () => {
    // The spec permits one orchestrated moment, motion answering a user action,
    // and state transitions. Scroll reveals are none of those, and the brief
    // names them as the generic default to remove. If whileInView appears here
    // the primitive has become the thing it replaced.
    expect(revealCode).not.toContain("whileInView");
    expect(revealCode).not.toContain("useInView");
    expect(revealCode).not.toContain("viewport");
  });
});
