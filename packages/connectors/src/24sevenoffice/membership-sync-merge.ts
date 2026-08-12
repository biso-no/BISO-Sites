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
