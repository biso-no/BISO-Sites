/**
 * Builds the `memberships` rows written by the 24SevenOffice catalog sync.
 *
 * Re-exported by `@repo/shared/utils/membership-sync-merge` for regression
 * testing, since this package has no vitest runner. The implementation lives
 * here (not in `@repo/shared`) because `@repo/connectors` cannot depend on
 * `@repo/shared` without creating a workspace dependency cycle (Turbo's
 * `_transit` task graph rejects it) — `@repo/shared` already depends on
 * `@repo/connectors`, so this direction resolves.
 */

export interface MembershipSyncItemLike {
  categoryId: number | null;
  expiryDate: string;
  isActive: boolean;
  price: number;
  productId: number;
  productName: string;
  startDate: string;
}

/**
 * Parse a product's price defensively. The 24SO SOAP client types `Price` as
 * a `number`, but the actual response is XML-derived and can hand back the
 * field as a string, empty, absent, or otherwise malformed — coerce and fall
 * back to 0 rather than writing `NaN` into Appwrite. Negative values are
 * clamped to 0: a negative ERP price is meaningless, and 0 already means
 * "not priced yet" everywhere downstream (`toMembershipPlan` rejects
 * non-positive prices), so a corrupt input simply becomes unsellable rather
 * than charging a negative amount.
 */
export function parsePrice(rawPrice: unknown): number {
  const parsed = Number(rawPrice);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/**
 * Builds the `memberships` row written by the 24SevenOffice catalog sync.
 * 24SO is the source of truth for name, price and dates. `canPurchase` is
 * written false and no longer read — what is for sale is decided from dates
 * (`@repo/shared/utils/membership-seasons`). `status` mirrors "not expired"
 * for older readers and is not used for decisions.
 */
export function mergeMembershipRow(
  item: MembershipSyncItemLike
): Record<string, unknown> {
  return {
    canPurchase: false,
    category: item.categoryId ? String(item.categoryId) : null,
    expiryDate: item.expiryDate,
    membership_id: String(item.productId),
    name: item.productName,
    price: Number(item.price ?? 0),
    startDate: item.startDate,
    status: item.isActive,
  };
}
