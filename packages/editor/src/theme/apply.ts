"use client";

/** Set --accent on a DOM element (typically the ThemeScope wrapper). */
export function applyAccent(el: HTMLElement, hex: string) {
  el.style.setProperty("--accent", hex);
}
