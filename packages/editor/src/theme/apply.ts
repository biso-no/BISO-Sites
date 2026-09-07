"use client";

/** Set --page-accent on a DOM element (typically the ThemeScope wrapper). */
export function applyAccent(el: HTMLElement, hex: string) {
  el.style.setProperty("--page-accent", hex);
}
