import { shopLimitFromParam } from "@repo/editor/page-feeds";
import { readPageProductsFeed } from "@repo/shared/utils/page-feeds";
import {
  feedClient,
  feedLocale,
  feedResponse,
  requireDepartment,
  requireFeedAuth,
} from "../_lib/feed";

/** A department's listed shop products, for the page editor's `productGrid` block. */
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
      await readPageProductsFeed(
        await feedClient(),
        department,
        feedLocale(searchParams),
        shopLimitFromParam(searchParams.get("limit"))
      )
    );
  } catch {
    return feedResponse([]);
  }
}
