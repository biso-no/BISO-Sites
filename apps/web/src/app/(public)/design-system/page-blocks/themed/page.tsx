import type { Metadata } from "next";
import { PageThemeStyle } from "@/components/page-theme-style";
import PageBlocksPage from "../page";

/**
 * The block gallery wearing a sample page theme (deep purple, lilac), to check
 * the nav, header, dark sections and footer recolour. A sibling route rather
 * than `?theme=sample`: reading `searchParams` would make the gallery dynamic.
 *
 * Internal and noindex, like the gallery it wraps.
 */
export const metadata: Metadata = {
  title: "Page blocks, themed | BISO",
  description: "Internal gallery of the page editor's blocks, themed.",
  robots: { index: false, follow: false },
};

const SAMPLE_THEME = { dark: "#3b1c6b", accent: "#c8a2f0" } as const;

export default function ThemedPageBlocksPage() {
  return (
    <>
      <PageThemeStyle theme={SAMPLE_THEME} />
      <PageBlocksPage />
    </>
  );
}
