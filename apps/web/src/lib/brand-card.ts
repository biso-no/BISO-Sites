/**
 * The one card treatment for feature and contact cards: a blue-tinted surface
 * and a blue-to-navy icon tile. Built on the themed `brand-*` tokens, so it
 * needs no `dark:` variants.
 */
export const BRAND_CARD = {
  icon: "from-brand-gradient-from to-brand-gradient-to",
  surface: "from-brand-muted to-card",
} as const;

/** Pill badge in the brand tint, for labels such as "Oslo only". */
export const BRAND_BADGE = "bg-brand-muted text-brand-dark";
