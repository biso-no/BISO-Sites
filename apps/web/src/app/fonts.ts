import { Inter } from "next/font/google";
import localFont from "next/font/local";

// Museo Sans ships here as a single static Light face. Declaring the real
// weight keeps the browser from treating it as Regular; anything bolder than
// 300 is synthesized until branding supplies the 500/700 cuts.
export const museoSans = localFont({
  src: "../../public/museo_sans_300.otf",
  variable: "--font-museo",
  weight: "300",
  style: "normal",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
