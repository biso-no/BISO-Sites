import type { PageFeedSnapshot } from "@repo/editor/page-feeds";
import { pruneEmptyFeedBlocks } from "@repo/editor/serialize";
import { RenderedPage } from "../../[...slug]/_components/rendered-page";
import { type WinterGamesLocale, winterGamesDoc } from "./doc";

/**
 * No live data. The document is not bound to a department until the seed
 * sets the Wintergames unit, so its events block (`source: "auto"`) asks for
 * no feed at all, and `pruneEmptyFeedBlocks` drops it as a live block with
 * nothing to read: the same collapse an empty feed gets on the site (C8).
 */
const NO_FEEDS: PageFeedSnapshot = {};

/**
 * The Winter Games document as the public route renders it: pruned, then
 * through `RenderedPage`. Shared by the Norwegian and English preview routes.
 */
export function WinterGamesPreview({ locale }: { locale: WinterGamesLocale }) {
  return (
    <RenderedPage
      doc={pruneEmptyFeedBlocks(winterGamesDoc(locale), NO_FEEDS, locale)}
      feeds={NO_FEEDS}
      locale={locale}
    />
  );
}
