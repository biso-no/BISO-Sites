/**
 * Re-exported from `@repo/connectors` so the 24SO membership sync's
 * price/canPurchase merge behaviour can be pinned by a regression test —
 * `packages/connectors` has no vitest runner.
 *
 * This module intentionally does not add a `@repo/connectors` dependency
 * edge back onto itself: `@repo/shared` already depends on
 * `@repo/connectors`, and the connector package cannot depend on
 * `@repo/shared` without creating a workspace dependency cycle (Turbo's
 * `_transit` task graph rejects it). The implementation therefore lives in
 * `@repo/connectors/src/24sevenoffice/membership-sync-merge.ts` and is
 * re-exported here.
 */
export {
  type ExistingMembershipRow,
  type MembershipSyncItemLike,
  mergeMembershipRow,
  parsePrice,
} from "@repo/connectors/24sevenoffice";
