# Admin order details + refunds (Vipps & Stripe)

**Date:** 2026-09-08
**Status:** Approved

## Problem

Two things are missing from the webshop.

1. **Refunds do not exist.** `refundVippsPayment` is implemented in
   `@repo/payment/vipps` but has zero callers. Stripe has no refund function at
   all. `orders` has no column to record a refund, so a partial refund has
   nowhere to live.
2. **Admin cannot inspect an order.** The orders tab renders a flat row per
   order with no drill-in — no line items, no custom-field answers, no payment
   or settlement state.

An audit of the payment path also surfaced four defects, fixed as part of this
work (see *Payment fixes*).

## Schema

Two new tables plus three columns on `orders`. All new tables carry
`rowSecurity: true` and the same operations-unit `$permissions` as `orders`.

### `order_refunds`

| column | type | notes |
|---|---|---|
| `order` | relationship → `orders` | oneToMany, twoWay, `twoWayKey: "refunds"`, cascade, side `child` |
| `amount` | double, required | NOK major units, matching `orders.total` |
| `currency` | enum `["NOK"]` | |
| `status` | enum `["pending","succeeded","failed"]` | written *before* the provider call so a crash mid-call is auditable |
| `provider` | enum `["vipps","stripe"]` | |
| `provider_refund_id` | string(255) | Stripe `re_…`; Vipps has no refund id, so the pspReference |
| `idempotency_key` | string(255) | sent to Stripe; also the double-submit guard |
| `reason` | string(500) | |
| `restock` | boolean | whether stock was returned |
| `finago_transaction_id` | string(64) | the reversal transaction, or a failure marker |
| `error` | string(1000) | provider/ledger failure detail |
| `created_by` | string(64) | admin user `$id` |
| `created_by_name` | string(255) | denormalized for the audit trail |
| `lines` | relationship → `order_refund_lines` | oneToMany, twoWay, side `parent` |

### `order_refund_lines`

`refund` (→ `order_refunds`, child, cascade), `order_item` (→ `order_items`,
manyToOne, setNull), `quantity` (integer), `amount` (double), `name`
(string 255).

`name` snapshots the line name at refund time for the same reason
`order_item_field_answers.label` does: an order is a historical record and the
product may later be renamed or deleted.

### `orders`

New columns `refunded_total` (double), `refunded_at` (datetime), `refund_lock`
(integer), and an index on `refunded_total`.

### No `partially_refunded` status

Deliberate. `ORDER_STATUS_FILTER` (checkout route) and `summarizePurchases`
(`@repo/shared/utils/purchase-limits`) count only `authorized` and `paid`
orders. A new status would drop partially-refunded orders out of per-user
purchase-limit counting, letting a buyer re-purchase a limited-quantity item by
obtaining a small goodwill refund.

So `status` stays `paid` until fully refunded, then flips to `refunded`. The
partial state is derived from `refunded_total`, and the admin UI renders a
"partially refunded" pill from that.

## Provider layer — `@repo/payment`

`refundVippsPayment` already exists. Added:

- `refundStripePayment(paymentIntentId, amountMinor, creds, opts)` —
  `stripe.refunds.create(…, { idempotencyKey })`.
- `refundPayment(request, creds)` in `src/refunds.ts` — dispatches on provider
  and normalizes both into `{ providerRefundId, refundedTotalMinor }`. Vipps'
  reference is `payment_session_id`; Stripe's is `payment_intent_id`.

**The Vipps SDK generates a fresh `Idempotency-Key` per request**
(`base_client_helper.js:25`), so a double-submitted refund would refund twice.
Stripe accepts a caller-supplied key. The `refund_lock` claim below is the real
guard for both.

## Orchestration — `@repo/shared/utils/order-refunds*.ts`

Pure/impure split, mirroring `vipps-pure` / `vipps-order-ops`.

`order-refunds-pure.ts` (unit tested): `computeRefundable(order, refunds)`,
`validateRefundRequest(…)`, `buildRefundLines(…)`,
`allocateAmountAcrossAccounts(…)`.

`order-refunds.ts` — `refundOrder(...)`:

1. Load order + existing refunds; validate `amount > 0` and
   `amount <= total − refunded_total`.
2. Claim `refund_lock` atomically (same pattern as `transition_lock`).
3. Write the `order_refunds` row as `pending`.
4. Call the provider.
5. On success: mark `succeeded`, recompute `refunded_total` from the provider's
   authoritative aggregate where available (Vipps returns
   `aggregate.refundedAmount`), set `refunded_at`, flip status to `refunded`
   when fully refunded.
6. Restock when requested, via `incrementRowColumn`.
7. Reverse the ledger — own try/catch; a failure is recorded on the refund row
   and never fails the refund.
8. Release the lock.

## Ledger reversal — `@repo/connectors`

`postShopRefundTransaction()` mirrors `postShopTransaction` with signs flipped:
credit the receivable account by the refunded total, debit each revenue account
by its refunded share. Line-item refunds map exactly; a free-amount refund is
allocated proportionally across the order's revenue accounts.

**Membership orders are excluded.** They are booked as a 24SO *invoice*, not a
ledger transaction, so reversing one needs a credit note. The UI says so and
leaves it for manual handling.

## Admin UI

New route `apps/admin/src/app/(portal)/shop/orders/[orderId]/page.tsx`, gated on
`canViewShopOperations` with the campus scoping `listOrders` already applies.
`OrderRow` becomes a link to it.

The page shows buyer, derived status, timeline, payment block (provider,
test/live, session + intent id, receipt), line items with variations and
custom-field answers, totals, ledger/fulfilment state, and a refund panel.

The refund panel (client component) offers per-line quantity steppers with a
live computed amount, a toggle to a free amount, a reason field, a "return items
to stock" checkbox, and the refund history. It is disabled when nothing is
refundable or the payment was never captured.

A `refundOrder` server action re-checks authorization, calls the orchestrator
with the admin client, writes an audit-log entry, and revalidates.

**Authorization:** `canViewShopOperations` (global admin + campus admin), the
same gate the orders tab already uses.

**Uncaptured payments:** an authorized-but-uncaptured Vipps payment is
*cancelled*, not refunded. That is a separate action in the same panel.

## Payment fixes

Found during the audit, in scope for this work.

1. **Stripe reconciliation.** `sweepUnsettledOrders` skips
   `payment_provider !== "vipps"`, so a Stripe order whose webhook never landed
   and whose buyer closed the tab stays PENDING forever — stock never
   decrements, revenue never posts. Extract a provider-agnostic
   `reconcileOrderPayment(orderId, db)` and use it in the cron sweep, the return
   route, and `verifyOrder`, collapsing three duplicated Stripe blocks.
2. **Debug logging.** The Vipps webhook-register route logs the MSN and secret
   length and returns the internal error `detail` to the caller; the admin
   action logs the same. Both are marked "remove before production" in their own
   comments.
3. **Receipt URLs.** `payment_receipt_url` is read in three places and written
   nowhere. On a paid Stripe transition, expand `payment_intent.latest_charge`
   and store `receipt_url`. The Vipps ePayment API exposes no receipt URL (its
   receipts endpoint only *attaches* one), so Vipps orders keep a null receipt
   link rather than a fabricated deep link.
4. **Checkout idempotency.** Apply the membership route's existing
   `findIdempotentOrder` pattern to the shop checkout route for both providers,
   so a double-submit reuses the in-flight order.

## Operational notes (not code)

- `payments_stripe` defaults to `false` in the feature-flag catalog. Card
  checkout stays hidden and the API returns 403 until it is enabled in admin.
- The Stripe webhook has no registration flow: add
  `https://<api-host>/api/payment/stripe/callback` in the Stripe dashboard and
  paste the `whsec_…` into admin → payment settings.
- The Vipps webhook secret is per-mode and per-MSN. Switching test → live
  requires clicking **Register webhook** again, or every delivery 401s.

## Testing

- Pure helpers: unit tests for refundable computation, validation boundaries,
  line building, and proportional allocation.
- Orchestrator: fake `DbClient` (the pattern `vipps-order-ops.test.ts` uses)
  covering the lock claim, over-refund rejection, provider failure leaving a
  `failed` row, full-refund status flip, and restock.
- Ledger reversal: line construction and balance-to-zero assertions.
- Reconcile: Stripe orders now swept; Vipps behaviour unchanged.
