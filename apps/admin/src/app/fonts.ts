import { Inter } from "next/font/google";
import localFont from "next/font/local";

/** Public-site typefaces, loaded for the page-editor canvas only. */
export const museoSans = localFont({
  src: "../../public/museo_sans_300.otf",
  variable: "--font-museo",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
