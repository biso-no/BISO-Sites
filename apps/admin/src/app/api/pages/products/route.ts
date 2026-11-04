import { shopLimitFromParam } from "@repo/editor/page-feeds";
import { readPageProductsFeed } from "@repo/shared/utils/page-feeds";
import { departmentFeedRoute, feedClient, feedLocale } from "../_lib/feed";

/** A department's listed shop products, for the page editor's `productGrid` block. */
export const GET = departmentFeedRoute(async (department, params) =>
  readPageProductsFeed(
    await feedClient(),
    department,
    feedLocale(params),
    shopLimitFromParam(params.get("limit"))
  )
);
