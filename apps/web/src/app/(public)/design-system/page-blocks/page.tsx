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

/**
 * The fixture is a made-up career fair. A strip that sticks under the fixed
 * nav (h-20) says so on every screen, in the marker's notice colours; navy
 * ink (`text-deep`) rather than `text-ink`, which turns paper-white on the
 * sun in the dark theme.
 */
export default function PageBlocksPage() {
  return (
    <>
      <p
        className="type-label sticky top-20 z-40 m-0 bg-marker px-4 py-2 text-center text-deep"
        role="note"
      >
        Eksempelinnhold — ikke et ekte arrangement
      </p>
      <RenderedPage doc={PAGE_BLOCKS_FIXTURE} feeds={{}} locale="no" />
    </>
  );
}
