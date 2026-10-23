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
 * The fixture is a made-up career fair. A strip fixed under the site's fixed
 * nav (h-20) says so on every screen, in the marker's notice colours; navy
 * ink (`text-deep`) rather than `text-ink`, which turns paper-white on the
 * sun in the dark theme. Fixed, not sticky: it takes no room in the flow, so
 * the header's navy still runs up behind the transparent nav, and it covers
 * only the header's top padding, never its text.
 */
export default function PageBlocksPage() {
  return (
    <>
      <p
        className="type-label fixed inset-x-0 top-20 z-40 m-0 truncate whitespace-nowrap bg-marker px-4 py-2 text-center text-deep"
        role="note"
      >
        <span className="sm:hidden">Eksempelinnhold</span>
        <span className="hidden sm:inline">
          Eksempelinnhold — ikke et ekte arrangement
        </span>
      </p>
      <RenderedPage doc={PAGE_BLOCKS_FIXTURE} feeds={{}} locale="no" />
    </>
  );
}
