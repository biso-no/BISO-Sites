import { feedLimitFromParam } from "@repo/editor/page-feeds";
import { cachedPageJobsFeed } from "@/lib/data/public-content";
import {
  feedFailure,
  feedLocale,
  feedResponse,
  requireDepartment,
} from "../_lib/feed";

/**
 * Open vacancies for a department for the page-builder's auto-source `jobs` block.
 *
 * Consumed by `packages/editor/src/blocks/jobs/render.tsx`, which expects a
 * bare JSON array. A failed feed renders as empty, never as an error, so this
 * route must answer 200 with `[]` rather than throw.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const department = requireDepartment(searchParams);
  if (!department) {
    return feedResponse([]);
  }
  try {
    return feedResponse(
      await cachedPageJobsFeed(
        department,
        feedLocale(searchParams),
        feedLimitFromParam(searchParams.get("limit"))
      )
    );
  } catch {
    return feedFailure();
  }
}
