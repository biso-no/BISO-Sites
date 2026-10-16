import { Inter } from "next/font/google";
import localFont from "next/font/local";

/**
 * Body and UI: Museo Sans, the brand face. 300 for text, 700 for bold — the two
 * cuts the Branding Committee supplied. (The "Museo_700.otf" that arrived with
 * them is the original Museo family, not Museo Sans, and is not used.)
 *
 * CSS font matching resolves a request for 400 or 500 to the 300 cut and 600 or
 * more to the 700 cut, so `font-medium` reads as Light and `font-semibold` as
 * Bold. Use `font-semibold`/`font-bold` where emphasis has to show.
 */
export const museoSans = localFont({
  src: [
    { path: "../../public/museo_sans_300.otf", weight: "300", style: "normal" },
    { path: "../../public/Museo_Sans_700.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-museo",
  display: "swap",
});

/**
 * Display: Museo Slab 700 and 900, the brand's heading face. Carries the
 * redesign's display type roles (`.type-display-*`, `.type-heading-section`,
 * `.type-label`) and every unstyled `h1`–`h3` on the brand surface.
 *
 * Replaces Archivo, which the redesign used only while no licensed heavy brand
 * cut existed (docs/redesign/01-design-spec.md §2.2 named the brand face as the
 * first choice). `--font-biso-display` in packages/ui/styles/biso-surface.css
 * points here.
 */
export const museoSlab = localFont({
  src: [
    { path: "../../public/Museo_Slab_700.otf", weight: "700", style: "normal" },
    { path: "../../public/Museo_Slab_900.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-museo-slab",
  display: "swap",
});

/**
 * Fallback behind both Museo faces, and the face for any glyph they lack.
 *
 * `latin` only, deliberately. Norwegian æ ø å live in Latin-1 Supplement
 * (U+00E5, U+00E6, U+00F8), which Google's `latin` subset covers. Adding
 * `latin-ext` doubled the preloaded font payload for glyphs the site never
 * renders. Verified in RD-006.
 */
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
