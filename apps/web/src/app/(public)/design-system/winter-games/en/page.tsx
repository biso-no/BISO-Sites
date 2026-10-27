import type { Metadata } from "next";
import { WinterGamesPreview } from "../preview";

/**
 * The Winter Games page document in English (C10), rendered like the
 * Norwegian preview one level up. A sibling route rather than `?locale=en`:
 * reading `searchParams` would make the preview dynamic.
 *
 * Internal and noindex, like the rest of `/design-system`.
 */
export const metadata: Metadata = {
  title: "Winter Games preview, English | BISO",
  description: "Internal preview of the Winter Games page document in English.",
  robots: { index: false, follow: false },
};

export default function WinterGamesEnglishPreviewPage() {
  return <WinterGamesPreview locale="en" />;
}
