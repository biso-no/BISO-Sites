import { cachedPageJobsFeed } from "@/lib/data/public-content";
import { feedLocale, feedResponse, requireDepartment } from "../_lib/feed";

/**
 * Open vacancies for a department for the page-builder's auto-source `jobs` block.
 *
 * Consumed by `packages/editor/src/blocks/jobs/render.tsx`, which expects a
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
      await cachedPageJobsFeed(department, feedLocale(searchParams))
    );
  } catch {
    return feedResponse([]);
  }
}
