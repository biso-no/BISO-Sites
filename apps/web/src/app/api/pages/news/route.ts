import { cachedPageNewsFeed } from "@/lib/data/public-content";
import { feedLocale, feedResponse, requireDepartment } from "../_lib/feed";

/**
 * Latest news for a department for the page-builder's auto-source `news` block.
 *
 * Consumed by `packages/editor/src/blocks/news/render.tsx`, which expects a
 * bare JSON array and silently falls back to the block's placeholder items on
 * any error — so this route must answer 200 with `[]` rather than throw.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const department = requireDepartment(searchParams);
  if (!department) {
    return feedResponse([]);
  }
  try {
    return feedResponse(
      await cachedPageNewsFeed(department, feedLocale(searchParams))
    );
  } catch {
    return feedResponse([]);
  }
}
