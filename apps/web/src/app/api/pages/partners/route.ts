import { cachedPagePartnersFeed } from "@/lib/data/public-content";
import { feedResponse } from "../_lib/feed";

/**
 * National partners for the page-builder's auto-source `partners` block.
 *
 * Unlike the other feeds this one takes no department — the block renders the
 * national partner set. See `../_lib/feed` for why failures answer 200.
 */
export async function GET() {
  try {
    return feedResponse(await cachedPagePartnersFeed());
  } catch {
    return feedResponse([]);
  }
}
