import { feedLimitFromParam } from "@repo/editor/page-feeds";
import { readPageNewsFeed } from "@repo/shared/utils/page-feeds";
import { departmentFeedRoute, feedClient, feedLocale } from "../_lib/feed";

/** Latest published news for one department, for the page editor's auto-source block. */
export const GET = departmentFeedRoute(async (department, params) =>
  readPageNewsFeed(
    await feedClient(),
    department,
    feedLocale(params),
    feedLimitFromParam(params.get("limit"))
  )
);
