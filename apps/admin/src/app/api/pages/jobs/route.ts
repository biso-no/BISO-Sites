import { readPageJobsFeed } from "@repo/shared/utils/page-feeds";
import {
  feedClient,
  feedLocale,
  feedResponse,
  requireDepartment,
  requireFeedAuth,
} from "../_lib/feed";

/** Open vacancies for one department, for the page editor's auto-source block. */
export async function GET(request: Request) {
  const unauthorized = await requireFeedAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const department = requireDepartment(searchParams);
  if (!department) {
    return feedResponse([]);
  }

  try {
    return feedResponse(
      await readPageJobsFeed(
        await feedClient(),
        department,
        feedLocale(searchParams)
      )
    );
  } catch {
    return feedResponse([]);
  }
}
