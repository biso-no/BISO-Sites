/**
 * Builds the `memberships` row written by the 24SevenOffice product sync.
 *
 * Price and `canPurchase` are administrator-owned once a row exists: the sync
 * seeds them on create and then leaves them alone, so marking a plan sellable
 * is not silently reverted on the next run.
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

export interface ExistingMembershipRow {
  canPurchase?: boolean | null;
  price?: number | null;
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

export function mergeMembershipRow(
  item: MembershipSyncItemLike,
  existing: ExistingMembershipRow | null
): Record<string, unknown> {
  const existingPrice = Number(existing?.price ?? 0);
  const price = existingPrice > 0 ? existingPrice : Number(item.price ?? 0);

  return {
    membership_id: String(item.productId),
    name: item.productName,
    category: item.categoryId ? String(item.categoryId) : null,
    expiryDate: item.expiryDate,
    startDate: item.startDate,
    status: item.isActive,
    price,
    canPurchase: existing?.canPurchase ?? false,
  };
}
