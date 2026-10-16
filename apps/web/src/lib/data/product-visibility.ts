import { Query } from "@repo/api";

/**
 * "This product belongs in a listing" — every public product listing filters on
 * it, and nothing else should.
 *
 * `unlisted` marks a product that is published and fully purchasable at its
 * `/shop/<slug>` link but must appear in no listing, feed or sitemap. The `or`
 * arm matters: a plain `Query.equal("unlisted", false)` matches only rows that
 * physically carry `false`, so any row written before the column existed — and
 * not backfilled — would be filtered out and the whole catalogue would vanish
 * from the shop the moment the column is pushed. Treating null as "listed"
 * fails in the safe direction (a product stays visible) rather than emptying
 * the storefront. `departments.active` is guarded the same way, in
 * `apps/admin/src/app/(portal)/_actions/departments.ts`.
 *
 * Deliberately not parameterised: no caller should be able to ask for unlisted
 * products in a listing, least of all a server action the browser can call.
 */
export function listedProductsOnly(): string {
  return Query.or([Query.equal("unlisted", false), Query.isNull("unlisted")]);
}
