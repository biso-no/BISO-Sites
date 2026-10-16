import { Inter } from "next/font/google";
import localFont from "next/font/local";

/** Public-site typefaces, loaded for the page-editor canvas only. */
export const museoSans = localFont({
  src: [
    { path: "../../public/museo_sans_300.otf", weight: "300", style: "normal" },
    { path: "../../public/Museo_Sans_700.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-museo",
  display: "swap",
});

/** The display face, so canvas headings match the live site. */
export const museoSlab = localFont({
  src: [
    { path: "../../public/Museo_Slab_700.otf", weight: "700", style: "normal" },
    { path: "../../public/Museo_Slab_900.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-museo-slab",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
