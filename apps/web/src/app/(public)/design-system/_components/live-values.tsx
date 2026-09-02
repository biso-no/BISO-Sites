"use client";

import { useEffect } from "react";

/**
 * Fills every `[data-computed-for]` slot with the value the browser actually
 * resolves for that custom property, and every `[data-contrast]` cell with a
 * ratio computed from painted colours.
 *
 * Deliberately measured rather than hardcoded. A design-system page that prints
 * the numbers its author typed proves nothing; this one fails visibly when a
 * token stops resolving or a pairing drifts below AA.
 */
const AA_NORMAL = 4.5;
const AAA_NORMAL = 7;
const AA_LARGE = 3;
const RGB_PARTS = /\d+/g;

function relativeLuminance([r, g, b]: readonly number[]): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.040_45 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(r as number) +
    0.7152 * channel(g as number) +
    0.0722 * channel(b as number)
  );
}

function contrastRatio(a: readonly number[], b: readonly number[]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function gradeFor(ratio: number, large: boolean): "aaa" | "aa" | "fail" {
  const floor = large ? AA_LARGE : AA_NORMAL;
  const excellent = large ? AA_NORMAL : AAA_NORMAL;
  if (ratio >= excellent) {
    return "aaa";
  }
  return ratio >= floor ? "aa" : "fail";
}

/** Fill the computed value of each custom property named on the page. */
function fillComputedTokens(): void {
  const styles = getComputedStyle(document.documentElement);
  for (const el of document.querySelectorAll<HTMLElement>(
    "[data-computed-for]"
  )) {
    const name = el.dataset.computedFor;
    if (!name) {
      continue;
    }
    const value = styles.getPropertyValue(name).trim();
    el.textContent = value || "unresolved";
    el.dataset.state = value ? "ok" : "unresolved";
  }
}

/**
 * Paint each colour into a throwaway node so `var(--x)` and a hex literal alike
 * come back as concrete rgb, whatever syntax the token was authored in.
 */
function makeColourReader(): {
  read: (colour: string) => number[] | null;
  dispose: () => void;
} {
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.append(probe);
  return {
    read(colour: string) {
      probe.style.color = "";
      probe.style.color = colour;
      const parsed = getComputedStyle(probe).color.match(RGB_PARTS);
      return parsed ? parsed.slice(0, 3).map(Number) : null;
    },
    dispose() {
      probe.remove();
    },
  };
}

function fillContrastCells(): void {
  const reader = makeColourReader();
  for (const el of document.querySelectorAll<HTMLElement>("[data-contrast]")) {
    const [fg, bg] = (el.dataset.contrast ?? "").split("|");
    const fgRgb = fg ? reader.read(fg) : null;
    const bgRgb = bg ? reader.read(bg) : null;
    if (!(fgRgb && bgRgb)) {
      el.textContent = "unresolved";
      el.dataset.level = "fail";
      continue;
    }
    const ratio = contrastRatio(fgRgb, bgRgb);
    el.textContent = `${ratio.toFixed(2)}:1`;
    el.dataset.level = gradeFor(ratio, el.dataset.large === "true");
  }
  reader.dispose();
}

export function LiveValues() {
  useEffect(() => {
    fillComputedTokens();
    fillContrastCells();
  }, []);

  return null;
}
