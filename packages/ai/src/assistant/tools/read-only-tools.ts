/**
 * Server tools that only read. Every other tool with a server `execute` is
 * gated: it runs only after the signed-in user confirms that exact call on the
 * card the chat shows for it. A new tool is gated until it is listed here.
 */
export const READ_ONLY_TOOL_NAMES: ReadonlySet<string> = new Set([
  "draftBilingualContent",
  "getAnalyticsSummary",
  "getContent",
  "getDashboardStats",
  "getFeatureFlags",
  "getInboxCounts",
  "getM365UserProfile",
  "getOpsHealth",
  "getOrderSummary",
  "listPendingApprovals",
  "lookupCustomer",
  "searchContent",
  "searchM365Users",
  "searchOrders",
]);
