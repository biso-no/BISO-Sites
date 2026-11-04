import { feedLimitFromParam } from "@repo/editor/page-feeds";
import { readPageEventsFeed } from "@repo/shared/utils/page-feeds";
import { departmentFeedRoute, feedClient, feedLocale } from "../_lib/feed";

/** Upcoming events for one department, for the page editor's auto-source block. */
export const GET = departmentFeedRoute(async (department, params) =>
  readPageEventsFeed(
    await feedClient(),
    department,
    feedLocale(params),
    feedLimitFromParam(params.get("limit"))
  )
);
