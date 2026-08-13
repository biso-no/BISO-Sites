/**
 * Re-exported from `@repo/connectors` so the 24SO `SaveCustomerCategories`
 * KeyValuePair orientation (Key=CategoryId, Value=CompanyId) can be pinned by
 * a regression test — `packages/connectors` has no vitest runner.
 *
 * This module intentionally does not add a `@repo/connectors` dependency
 * edge back onto itself: `@repo/shared` already depends on
 * `@repo/connectors`, and the connector package cannot depend on
 * `@repo/shared` without creating a workspace dependency cycle (Turbo's
 * `_transit` task graph rejects it). The implementation therefore lives in
 * `@repo/connectors/src/24sevenoffice/categories.ts` and is re-exported here.
 */
export { buildCustomerCategoryPairs } from "@repo/connectors/24sevenoffice";
