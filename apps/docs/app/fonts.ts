import localFont from "next/font/local";

/**
 * The docs set everything in Museo, like apps/web (see apps/web/src/app/fonts.ts):
 * these four cuts are the only fonts the site loads. `--font-museo` and
 * `--font-museo-slab` are the variables packages/ui/styles/biso-surface.css
 * reads for `--font-biso-sans` and `--font-biso-display`.
 *
 * CSS font matching resolves 400 or 500 to the 300 cut and 600 or more to the
 * 700 cut, so `font-medium` reads as Light. Use `font-semibold` or `font-bold`
 * where emphasis has to show.
 */
export const museoSans = localFont({
  src: [
    { path: "../public/museo_sans_300.otf", weight: "300", style: "normal" },
    { path: "../public/Museo_Sans_700.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-museo",
  display: "swap",
});

/** Display: Museo Slab 700 and 900, for headings. */
export const museoSlab = localFont({
  src: [
    { path: "../public/Museo_Slab_700.otf", weight: "700", style: "normal" },
    { path: "../public/Museo_Slab_900.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-museo-slab",
  display: "swap",
});
