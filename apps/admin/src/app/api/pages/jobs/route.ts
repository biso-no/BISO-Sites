import { feedLimitFromParam } from "@repo/editor/page-feeds";
import { readPageJobsFeed } from "@repo/shared/utils/page-feeds";
import { departmentFeedRoute, feedClient, feedLocale } from "../_lib/feed";

/** Open vacancies for one department, for the page editor's auto-source block. */
export const GET = departmentFeedRoute(async (department, params) =>
  readPageJobsFeed(
    await feedClient(),
    department,
    feedLocale(params),
    feedLimitFromParam(params.get("limit"))
  )
);
