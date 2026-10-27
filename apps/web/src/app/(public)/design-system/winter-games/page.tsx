import type { Metadata } from "next";
import { WinterGamesPreview } from "./preview";

/**
 * The Winter Games page document in Norwegian, rendered through the same
 * `RenderedPage` the public site uses, to check it before the draft is seeded.
 * The English one is at `./en`.
 *
 * Internal: `/design-system` is disallowed in robots.ts and, like the rest of
 * that tree, is not listed in sitemap.ts.
 */
export const metadata: Metadata = {
  title: "Winter Games preview | BISO",
  description: "Internal preview of the Winter Games page document.",
  robots: { index: false, follow: false },
};

export default function WinterGamesPreviewPage() {
  return <WinterGamesPreview locale="no" />;
}
