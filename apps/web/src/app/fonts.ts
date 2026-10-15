import { Inter } from "next/font/google";
import localFont from "next/font/local";

// Museo Sans is the body face: 300 for text, 700 for bold. (The "Museo_700.otf"
// in public/ is the original Museo family, not Museo Sans, and is not used.)
export const museoSans = localFont({
  src: [
    { path: "../../public/museo_sans_300.otf", weight: "300", style: "normal" },
    { path: "../../public/Museo_Sans_700.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-museo",
  display: "swap",
});

// Museo Slab is the display face: headings on biso.no and in editor pages.
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
