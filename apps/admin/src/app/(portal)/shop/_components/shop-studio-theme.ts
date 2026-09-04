/**
 * Visual constants and value formatters shared by every shop studio module.
 * Pure — no React, no hooks.
 */

export const BRAND = {
  claret: "#6b1e1e",
  gold: "#b08a3e",
  ink: "#1a1814",
  ink2: "#3a342a",
  ink3: "#6b6357",
  ink4: "#9c9385",
  leaf: "#2f5d3a",
  paper: "#faf7f2",
  paper2: "#f3eee5",
  paper3: "#ede6d8",
  rule: "#e5dcca",
  rule2: "#d8cdb6",
  sky: "#2a4a7a",
} as const;

export const SERIF_STACK =
  '"Cormorant Garamond", "EB Garamond", "Times New Roman", Georgia, serif';
export const MONO_STACK =
  '"IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const NOK_FORMATTER = new Intl.NumberFormat("nb-NO", {
  currency: "NOK",
  maximumFractionDigits: 0,
  style: "currency",
});

export function normalizeLocale(locale: string): "en" | "no" {
  return locale === "no" ? "no" : "en";
}

export function fmtNOK(amount: number): string {
  return NOK_FORMATTER.format(amount);
}

export function fmtDate(iso: string, locale: "en" | "no"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    day: "numeric",
    month: "short",
  }).format(d);
}
