import { readPagePartnersFeed } from "@repo/shared/utils/page-feeds";
import { feedClient, feedResponse, requireFeedAuth } from "../_lib/feed";

/**
 * National partners for the page editor's auto-source `partners` block.
 * Unlike the department feeds this one takes no parameters.
 */
export async function GET() {
  const unauthorized = await requireFeedAuth();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    return feedResponse(await readPagePartnersFeed(await feedClient()));
  } catch {
    return feedResponse([]);
  }
}
