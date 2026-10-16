import { normalizeMembershipDate } from "@repo/shared/utils/membership-dates";
import { osloToday } from "@repo/shared/utils/membership-status";

interface OrderItemLike {
  product_type?: string;
  start_date?: string | null;
}

/**
 * The start date (YYYY-MM-DD) of a membership in this order that has not
 * started yet — bought for next season — or null. The order line snapshots
 * the plan's `start_date` at checkout.
 */
export function upcomingMembershipStart(
  items: OrderItemLike[],
  now: Date = new Date()
): string | null {
  const today = osloToday(now);
  for (const item of items) {
    if (item.product_type !== "membership") {
      continue;
    }
    const start = normalizeMembershipDate(item.start_date);
    if (start && start > today) {
      return start;
    }
  }
  return null;
}
