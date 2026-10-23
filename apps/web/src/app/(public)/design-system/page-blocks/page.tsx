import type { Metadata } from "next";
import { RenderedPage } from "../../[...slug]/_components/rendered-page";
import { PAGE_BLOCKS_FIXTURE } from "./fixture";

/**
 * Gallery of every page-editor block, rendered through the same `RenderedPage`
 * the public site uses. It is the verification surface for the page editor's
 * visual language.
 *
 * Internal: `/design-system` is disallowed in robots.ts and, like the rest of
 * that tree, is not listed in sitemap.ts.
 */
export const metadata: Metadata = {
  title: "Page blocks | BISO",
  description: "Internal gallery of the page editor's blocks.",
  robots: { index: false, follow: false },
};

export default function PageBlocksPage() {
  return <RenderedPage doc={PAGE_BLOCKS_FIXTURE} feeds={{}} locale="no" />;
}
