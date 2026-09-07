import { Archivo, Inter } from "next/font/google";

/**
 * Body and UI. Renders every character on the site today and is kept: the
 * reference design's body copy is a neutral grotesque, Inter has the tabular
 * numerals the `data` type role needs, and keeping it spends the personality
 * budget on the display face and the chevron instead.
 */
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * Display. Heavy uppercase grotesque for the hero and section headings — the
 * treatment the chosen reference direction is built on.
 *
 * Replaces Museo Sans 300, which shipped as a 62 KB unsubsetted `.otf`,
 * appeared in the `Link: rel=preload` header on every route, and was rendered
 * **zero times** — the `font-display` utility appeared nowhere in the codebase
 * (see 00-current-state.md §4 and baseline/README.md FINDING-B). Museo Sans was
 * also Light-only, so it could not have produced this treatment at any weight.
 *
 * Museo Sans 900 remains the brand-correct choice if BISO holds a web licence
 * at that weight; swapping back is a change to this file plus the
 * `--font-biso-display` line in packages/ui/styles/biso-surface.css.
 *
 * Variable, so 800 and 900 cost one file.
 *
 * `latin` only, deliberately. Norwegian æ ø å live in Latin-1 Supplement
 * (U+00E5, U+00E6, U+00F8), which Google's `latin` subset covers — Inter has
 * shipped `latin` alone on this Norwegian-default site all along. Adding
 * `latin-ext` to both faces doubled the preloaded font payload from 109 KB to
 * 196 KB for glyphs the site never renders. Verified in RD-006.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
});
