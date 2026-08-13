/**
 * 24SevenOffice Membership Sync Service
 *
 * Orchestrates the synchronization of membership purchases to 24SevenOffice.
 * When a user purchases a membership:
 * 1. Find or create customer in 24SO CRM
 * 2. Assign the membership category to the customer
 */

/**
 * Check if an order contains a membership product
 *
 * @param itemsJson - The items_json string from the order
 * @returns true if order contains a membership product
 */
export function hasMembershipProduct(itemsJson: string | null): boolean {
  if (!itemsJson) {
    return false;
  }

  try {
    const items = JSON.parse(itemsJson);
    if (!Array.isArray(items)) {
      return false;
    }

    return items.some(
      (item) =>
        item.product_type === "membership" ||
        item.category?.toLowerCase() === "membership"
    );
  } catch {
    return false;
  }
}
