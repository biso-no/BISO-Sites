# Whitelabel Feasibility — Payments & Commerce

> Investigation area 3 of 6. Analysis only — no code changes proposed here.
> Portability tags: **portable** (a) · **moderate** (b) · **blocker** (c).

## Verdict for this area

**The payment core is the most whitelabel-ready subsystem in the repo.** It
was deliberately refactored into a provider-abstracted shape: a shared
`CheckoutSessionParams` type, symmetric Vipps/Stripe modules, one
provider-agnostic order state machine, DB-managed per-provider credentials
with test/live modes, and a dynamic `/api/payment/[provider]/…` route family.
A tenant configuring only Stripe can transact end-to-end today.

The real blockers are adjacent, not core: (1) `"NOK"` is a closed enum at the
checkout boundary, (2) 24SevenOffice/Finago is the *only* accounting sink
(though it fails soft), and (3) membership verification is bound to Finago
customer categories. Vipps, Finago, and the orphaned WooCommerce proxy are
all cleanly severable for a non-Norwegian tenant.

---

## Findings

### PAY-01 · portable · `packages/payment` · Provider abstraction by convention (shared types + shared state machine)
**Current state:** no runtime `PaymentProvider` interface, but two symmetric
implementations under one contract: `CheckoutSessionParams`
(`packages/payment/src/vipps/types.ts:5-36`, re-exported by
`stripe/types.ts:1`); `createVippsPayment(params, creds, urls)`
(`src/vipps/index.ts:78-109`) mirrors `createStripeCheckoutSession(params,
creds, urls)` (`src/stripe/index.ts:32-54`, which documents "matching the
Vipps shape"). Both feed the shared order state machine
`applyOrderStatusTransition()` (`packages/shared/utils/vipps-order-ops.ts:226`
— note the misleading `vipps-` namespace on provider-agnostic logic), with
per-provider status mappers (`vipps-pure.ts:44`, `stripe-pure.ts:40`).
**Managed version:** already fits per-tenant provider config; formalizing the
interface is optional polish.

### PAY-02 · portable · `packages/payment/src/credentials` · Per-provider DB-managed credentials — the most multi-tenant-ready piece
**Current state:** one Appwrite row per provider (`$id` = `"vipps"|"stripe"`)
with encrypted test+live secret columns and a `test_mode` toggle
(`src/credentials/types.ts:11-28`); `resolveVippsCredentials`/
`resolveStripeCredentials` read the DB row (15s TTL cache) with env fallback
(`src/credentials/resolve.ts:58-72`); credentials always injected into
clients, never read from env inside client builders (`src/vipps/client.ts:4-8`,
`src/stripe/client.ts:3-7`). Pure, unit-tested selectors. Admin UI at
`apps/admin/(portal)/settings/payments/`.
**Managed version:** this pattern (settings row per provider, admin-managed)
is the template the rest of the platform's org config should follow.

### PAY-03 · blocker (trivially widened) · `apps/api`, `apps/web` · Currency closed to NOK at the checkout boundary
**Current state:** the checkout body type declares `currency: "NOK"` and
`isValidBody` **rejects** anything else
(`apps/api/src/app/api/payment/[provider]/checkout/route.ts:39,96-98`); the
web action forces `currency: "NOK"`
(`apps/web/src/app/actions/orders.ts:507,510,619`); `enum Currency { NOK }`
(`packages/payment/src/vipps/types.ts:1-3`). Display formatting hardcodes
`nb-NO`/`NOK` (`checkout-page-client.tsx:32-35`) and `formatPrice` appends a
literal `" NOK"` (`apps/web/src/lib/types/webshop.ts:37-42`, repeated in
`price-details.tsx:39,53`, `units/[id]/components/products-tab.tsx:57-80`).
Minor-unit math assumes 2-decimal currencies (×100) in both providers
(`vipps/index.ts:27-34`, `stripe/index.ts:23`) — breaks for zero-decimal
currencies like JPY.
**Managed version:** per-tenant currency + locale config threaded through the
checkout contract and formatters. Classified blocker because it's a hard
validation today, but the fix is narrow and mechanical.

### PAY-04 · blocker (dead weight, severable) · `packages/payment/vipps` · Vipps is Nordic-only
**Current state:** Vipps ePayment accepts only NOK/DKK/EUR
(`vipps/index.ts:29-30`). Vipps has the richer lifecycle (get, capture,
cancel, refund, webhook self-registration, idempotent reconcile —
`index.ts:112-321`); Stripe is thinner — create/get/verify only, relying on
automatic capture; **no Stripe refund/capture/cancel ops exist yet**
(`stripe/index.ts`). Vipps client hardcodes `pluginName: "biso-payment"`,
`systemName: "biso"` (`vipps/client.ts:16-19`).
**Managed version:** Vipps stays as an optional Nordic provider (feature
flags `payments_vipps`/`payments_stripe` already gate providers per
deployment — `checkout/route.ts:669-670`). A card-only tenant needing refunds
requires adding Stripe refund ops (moderate, unwritten but standard SDK work).

### PAY-05 · portable · apps · Checkout flow is provider-agnostic end to end
**Current state:** checkout UI renders a radio group over `enabledProviders`
with icons for both providers (`checkout-page-client.tsx:46-52,295`); the
server action takes `provider: "vipps"|"stripe"`, re-prices server-side, and
POSTs to `${API}/api/payment/${provider}/checkout` (`orders.ts:130,533`);
dynamic `[provider]` API routes branch internally
(`checkout/route.ts:590,621`); return route syncs status provider-agnostically
(`apps/web/src/app/api/checkout/return/route.ts:32,42-57`); unified callback
route dispatches Vipps HMAC vs Stripe signature verification
(`callback/route.ts:55,102`; `vipps/webhook.ts:81-108`;
`stripe/index.ts:70-81`). Legacy webhook returns 410.
**Residue:** webhook-register route has leftover DEBUG `console.log` + a
`detail` field marked "Remove before production"
(`webhooks/register/route.ts:52-57,128-133`); biso.no URL fallbacks
(`checkout/return/route.ts:22`); CORS allow-list hardcoded (see INV-04).

### PAY-06 · blocker (fails soft) · `packages/connectors/24sevenoffice`, `packages/shared` · Finago is the only accounting sink
**Current state:** every settled order posts a GL transaction to Finago via
`postShopTransaction` (`connectors/.../rest/transactions.ts:71-143`) →
`postFinagoTransactionForOrder`
(`packages/shared/utils/finago-order-posting.ts:108`), invoked from all three
settlement paths (webhook `callback/route.ts:97,132`, return route
`checkout/return/route.ts:126`, reconcile cron) with an atomic
`finago_posting_lock` for exactly-once. Hardcoded Norwegian
chart-of-accounts concepts: `TFSO_VIPPS_RECEIVABLE_ACCOUNT`, transaction-type
numbers, campus→`DepartmentId` dimension map (`transactions.ts:87-93,256-278`
— env-overridable but BISO-defaulted). Expense posting and membership
invoicing (14-day Norwegian payment terms, hardcoded campus department IDs —
`invoice.ts:49-63,96`) run through the same connector. No
`AccountingProvider` abstraction exists.
**Mitigation:** posting is best-effort and non-fatal — errors are swallowed
(`callback/route.ts:39-53`) and unset `TFSO_*` env means orders still settle
with no ledger posting (`transactions.ts:81-85`).
**Managed version:** short term, "accounting off" is a working per-tenant
state; long term an accounting-provider abstraction (or export-file approach)
if tenants need ledger integration.

### PAY-07 · blocker · `apps/web`, shared · Membership verification bound to Finago categories + external function
**Current state:** `computeMembershipStatus` calls 24SO
`getCustomerCategories(numericId)` and matches Finago category-ID strings
(`apps/web/src/lib/actions/membership.ts:116-156`); student-ID→customer
resolution via `student_id` (`:252`). Checkout member discounts call the
external Appwrite Function `verify_biso_membership`
(`checkout/route.ts:414`, `orders.ts:82`) — gated per product by
`member_discount_enabled` metadata (`checkout/route.ts:400-405`). Membership
*definitions* are mirrored into the Appwrite `memberships` table with
`price: 0, canPurchase: false` (`24sevenoffice/membership-sync.ts:140-149`) —
membership is actually *sold* on the legacy WordPress shop
(`membership-page-client.tsx:615`).
**Managed version:** pluggable membership provider per tenant (same
conclusion as AUTH-08); tenants without member pricing are unaffected today.

### PAY-08 · portable (delete) · `apps/api` · WooCommerce proxy is orphaned dead code
**Current state:** no WooCommerce connector exists in `packages/connectors`;
the only trace is `apps/api/src/app/api/wc-products/route.ts` proxying the
legacy WordPress shop `https://biso.no/wp-json/wc/v3/products` (`:3`) with a
hardcoded campus→tag map (`:6-16`). **Zero consumers in the repo.** Native
commerce is fully on Appwrite `webshop_products`.
**Managed version:** delete the route. No tenant impact.

### PAY-09 · moderate · misc · VAT/tax logic effectively absent
**Current state:** no VAT computation in checkout; Finago shop postings use
`tax: { number: 0 }` (`rest/transactions.ts:99,132`); expense tax code is
env-set, default 0 (`:167,208`). Prices are treated as tax-inclusive/ignored.
Phone placeholders hint `+47` in i18n copy but the field is free-text
(`checkout-page-client.tsx:269-280`).
**Managed version:** tenants needing VAT lines (EU B2C rules etc.) require
new tax logic — none exists to generalize; that's greenfield, not refactor.

---

## Answer: what works for a non-Norwegian tenant today

Configure Stripe only; leave `VIPPS_*`/`TFSO_*` unset (both fail soft);
disable per-product member discounts (or supply a replacement membership
function); widen the NOK validation/enum and the `nb-NO`/`" NOK"` formatters.
With that, the native shop → Stripe Checkout → order state machine → receipt
flow is fully functional. Vipps, 24SevenOffice/Finago, and WooCommerce are
severable dead weight for such a tenant — none is load-bearing on the Stripe
path.

## Classification rollup

| ID | Portability | Scope |
|---|---|---|
| PAY-01 | portable | Provider abstraction (shared params + state machine) |
| PAY-02 | portable | DB-managed per-provider credentials, test/live modes |
| PAY-03 | **blocker** (narrow fix) | `"NOK"` closed enum + locale-fixed formatters |
| PAY-04 | blocker (severable) | Vipps Nordic-only; Stripe missing refund ops (moderate) |
| PAY-05 | portable | Provider-agnostic checkout/callback/return flows |
| PAY-06 | **blocker** (fails soft) | Finago-only accounting, no ledger abstraction |
| PAY-07 | **blocker** | Membership status bound to Finago categories |
| PAY-08 | portable (delete) | Orphaned WooCommerce proxy |
| PAY-09 | moderate | No VAT engine; Norwegian norms assumed by omission |
