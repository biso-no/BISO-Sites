import { Inter } from "next/font/google";
import localFont from "next/font/local";

// Museo Sans ships as a single static Light face. Declaring the real weight
// keeps the browser from treating it as Regular; anything bolder than 300 is
// synthesized until branding supplies the 700 cut (the "Museo_700.otf" in
// public/ is the original Museo family, not Museo Sans, so it is not used).
export const museoSans = localFont({
  src: "../../public/museo_sans_300.otf",
  variable: "--font-museo",
  weight: "300",
  style: "normal",
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
