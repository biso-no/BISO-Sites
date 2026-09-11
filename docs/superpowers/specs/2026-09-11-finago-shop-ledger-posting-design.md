# Webshop → Finago ledger posting

> Status: design approved in brainstorming, 2026-09-11. Implementation plan next.

## Goal

Every paid webshop order is booked in Finago (24SevenOffice) automatically,
the same way the monthly WordPress "Export orders" booking was done by hand —
no manual export, no customer records, no product sync.

Approach 1 (Finago customers + sales orders) was rejected; see Findings.

## Findings that drove the design

All gathered read-only against production Appwrite and Finago on 2026-09-11.

**Existing code.** A shop ledger posting already exists
(`packages/shared/utils/finago-order-posting.ts` →
`postShopTransaction` in `packages/connectors/src/24sevenoffice/rest/transactions.ts`),
with an exactly-once claim lock, three triggers (API webhook, web return route,
web reconcile cron) and a refund reversal. It has never posted successfully.

**Production state.**
- 14,095 of 14,101 orders are WordPress imports stamped
  `finago_transaction_id = "wordpress-import"` and are correctly excluded.
- The only paid new-platform order, `6aa19747003c79019977` (490 kr, 2026-09-09),
  is stranded at `finago_transaction_id = "posting"`, `finago_posting_lock = 1`.
  Finago has no ±490 lines on 2026-09-09/10: nothing was booked.
- 57 of 58 products have no `finago_account_number`. A missing account (or a
  missing env var) throws *after* the "posting" marker is written, so a
  deterministic configuration gap is treated as "maybe posted" and strands
  the order. Every new order would strand the same way.
- The existing code sends line dimensions as `{ type, value }`; the Finago
  schema requires `{ dimensionType, value }`.
- The existing code sends VAT code 0 on revenue lines.

**Customer search (why not Approach 1).**
- REST `GET /customers` has no name or email filter (`?name=` is silently ignored).
- SOAP `GetCompanies.CompanyName` is exact but case-insensitive, and `%` is a
  wildcard (a 5-char prefix + `%` returned 38,162 customers).
- On 30 recent buyers: the checkout name matched 1/30, `(Student) Last, First`
  26/30, email 2/30. Matches rely on students already existing in the CRM from
  memberships; guests, name splitting and homonyms make it unreliable.

**How Finago already settles payments.**
- Clearing accounts exist: **1530 Mellomregningskonto Vipps**,
  **1540 Mellomregningskonto Stripe**.
- Every Vipps/Stripe payout since April is a Bank voucher crediting the
  clearing account by the **gross** amount and debiting the **actual fee** to
  7775, e.g. #3012: `1530 −5 050,00 / 1920 +4 888,96 / 7775 +161,04`.
  Refunds are netted on the payout (#3009: `1530 +4 500 … refusjoner`).
- The WordPress-era monthly shop booking was an *Inntektsrapport* voucher
  debiting 1530 and crediting 3100/3150/3620 per product, **plus** estimated
  2,99 % fee lines — while payouts also booked fees.

**VAT codes** (SOAP `GetTaxCodeList`; REST `/taxes` is 403 for our client).
Account default tax *id* → posting tax *number*:

| Account | Tax id | Tax number | Meaning |
|---|---|---|---|
| 3000 Salgsinntekt, høy sats | 3 | 3 | Utgående avgift, høy sats (25 %, → 2700) |
| 3100 Salgsinntekt – egenandeler | 8 | 5 | Avgiftsfritt salg innenfor avg.området |
| 3150 Salgsinntekt, avgiftsfritt | 8 | 5 | same |
| 3620 Leie bokskap | 8 | 5 | same |

**Dimensions** (`GET /dimensions`): Department = type **2**, Campus = type **101**.
`webshop_products.departmentId` equals the Finago department value (verified
for 44, 21, 801, 1, 600, 1000, 16, 30). App `campus_id` 1–5 equals the Campus
dimension values exactly.

## Decisions

1. **Ledger voucher per paid order** (Approach 2), transaction type number
   **8 – Inntektsrapport**. No customer, no product sync.
2. **Debit the provider's clearing account by the gross total** (1530 Vipps,
   1540 Stripe). Payout vouchers then return it to ≈0; its balance is always
   "captured, not yet paid out".
3. **No fee lines.** Payout vouchers already book the actual fee to 7775.
4. **Revenue lines credit the sales type's account with that account's VAT
   code**; amounts are VAT-inclusive and Finago splits VAT to 2700.
5. **Dimensions on revenue lines:** Department = product department,
   Campus = order campus.
6. **The API app owns every provider and Finago call.** The web app (and the
   Flutter app) call the API app or Appwrite only.
7. **Accounting choices live in admin, not env.** Global admins and campus
   admins can edit them.
8. **Memberships are unchanged** (booked as invoices by `fulfilMembershipOrder`).

## Architecture

### Trigger ownership (API app only)

| Trigger | Today | After |
|---|---|---|
| Provider webhook | `apps/api/.../payment/[provider]/callback` → `settleOrderIfPaid` | unchanged |
| Buyer returns from provider | `apps/web/src/app/api/checkout/return` reconciles + settles | **new** `apps/api/src/app/api/payment/return/route.ts` does the same, then redirects to the web receipt or the app deep link |
| Reconcile sweep | `apps/web/src/app/api/cron/reconcile-orders` | **moved** to `apps/api/src/app/api/cron/reconcile-orders/route.ts` (same four passes, `CRON_SECRET` like `expenses/post-pending`) |
| Web "verify order" | `verifyOrder` action imports `@repo/payment/reconcile` | calls API `GET /api/payment/orders/[orderId]` with the user's JWT (already used by the Flutter app) |

- Membership fulfilment (`fulfilMembershipOrder`, a 24SO invoice) moves with
  these triggers: the API return route and API cron call `settleOrderIfPaid`,
  which already routes memberships to fulfilment and shop orders to posting.
- `packages/shared/utils/checkout-return.ts` and both API checkout routes
  (`checkout`, `membership-checkout`) build the return/success/cancel URLs
  against the API base URL.
- The web `/api/checkout/return` route becomes a redirect-only shim to the API
  route (no third-party calls) for provider sessions created before the
  deploy; delete it one week after rollout.
- The web reconcile cron route is deleted once `ORDERS_RECONCILE_URL` in
  `functions/scheduled-dispatch` points at `https://api.biso.no/api/cron/reconcile-orders`.
  Running both briefly is safe: the claim locks make settlement exactly-once.

### Accounting configuration (admin)

**Page:** `/shop/accounting` ("Regnskap"), new nav key
`portal.shopAccounting: [globaladmin, campusadmin]` (the `/settings` area is
global-admin only). Server actions check the role, write with the admin client,
call `logAuditEvent`, and `revalidatePath`.

**Sales types** — new table `sales_types`:

| Column | Type | Notes |
|---|---|---|
| `label_no` | string(80) | shown to product authors |
| `label_en` | string(80) | |
| `account_number` | integer | picked from `ledger_accounts` |
| `active` | boolean | inactive types are hidden from the product dropdown |
| `sort_order` | integer | |

Row ids are readable slugs (`egenandel`, `varesalg`, `bokskapleie`,
`annet-avgiftsfritt`). Table permissions: Operations Unit only; admin actions
write through the admin client after the role check, and the API app reads with
its API key. VAT is **not** a column: it is the account's default VAT code
from Finago, shown read-only next to the account. To change VAT, pick a
different account (the chart already separates 3000 from 3150).

Seed rows:

| label_no | label_en | account | VAT (derived) |
|---|---|---|---|
| Egenandel (turer, hytteturer, arrangementer) | Personal contribution (trips, events) | 3100 | 5 |
| Varesalg – klær og merch (25 % mva) | Merchandise (25 % VAT) | 3000 | 3 |
| Bokskapleie | Locker rental | 3620 | 5 |
| Annet avgiftsfritt salg | Other VAT-exempt sales | 3150 | 5 |

**Shop posting settings** — row `accounting` in the existing, unused
`shop_settings` table, `general` holds JSON validated by a zod schema in
`@repo/shared`:

```json
{ "transactionTypeNumber": 8, "clearingAccounts": { "vipps": 1530, "stripe": 1540 } }
```

**Kill switch** — feature flag `shop_ledger_posting` (existing `feature_flags`
table + catalog in `packages/shared/utils/feature-flags.ts`), default off,
editable on the same page. When off, posting returns `disabled` without
claiming, and the API cron skips its Finago pass entirely (like
`expenses/post-pending` does for `expenses_ledger_posting`), so unposted orders
wait without being re-read every run. The Finago pass orders by `$createdAt`
ascending so the oldest unposted orders go first.

**Ledger accounts + VAT numbers** — the existing "sync from Finago" route
(`apps/admin/src/app/api/expenses/ledger-accounts/sync`) additionally fetches
the SOAP tax code list and writes the posting tax **number** to a new
`ledger_accounts.vat_code` integer column. The existing `tax_code` column
(Finago tax *id*) is left as is. The Regnskap page exposes the sync button.

**Stays in env (API app only):** Finago credentials (`TFSO_REST_CLIENT_ID`,
`TFSO_REST_CLIENT_SECRET`, `TFSO_REST_ORG_ID`, `TFSO_APP_ID`, `TFSO_USERNAME`,
`TFSO_PASSWORD`). These are IT secrets, not accounting choices.
**Code constants:** dimension types Department = 2, Campus = 101.
**Removed env:** `TFSO_SHOP_TRANSACTION_TYPE_NUMBER`,
`TFSO_VIPPS_RECEIVABLE_ACCOUNT`.

### Products and order snapshot

- `webshop_products.sales_type` (string, `sales_types` row id) replaces the
  free-text account field in `shop-studio-editor.tsx`. `finago_account_number`
  on products is no longer read.
- Publishing (`published` / `pending_approval`) requires an active sales type
  (`apps/admin/src/app/(portal)/_actions/schemas.ts`).
- At checkout (`apps/api/src/lib/checkout-pricing.ts`) the API app resolves the
  product's sales type and snapshots onto `order_items`:
  `finago_account_number` (exists), new `finago_vat_code` (integer),
  new `finago_department` (string).
  A missing or inactive sales type does not block checkout; the snapshot is
  left empty and posting resolves it later (below).
- Changing a sales type affects future orders only. Refunds mirror the snapshot.

### Voucher shape

For order `6aa19747…`, 490 kr via Vipps, product department 44, campus 1,
sales type *Varesalg*:

```
transactionTypeNumber 8   date 2026-09-11 (Europe/Oslo)   comment "Nettbutikk 6aa19747003c79019977"
1530  +490,00  tax 0
3000  −490,00  tax 3   dims [{2,"44"},{101,"1"}]   comment "Gensere til børsgruppen ×1"
      → Finago books 392,00 to 3000 and 98,00 to 2700
```

Revenue lines are grouped by (account, VAT code, department). The builder
asserts the lines sum to zero.

## Posting flow

`postFinagoTransactionForOrder(orderId, db)` in `@repo/shared`:

1. Load order + items. Return `not_paid`, `already_posted`, or
   `membership_order` as today. A paid order with a zero total is stamped
   `finago_transaction_id = "zero-total"` and returns `zero_total`, so it
   leaves the sweep.
2. If `shop_ledger_posting` is off → `disabled` (no claim, no stamp).
3. Claim `finago_posting_lock` atomically (unchanged).
4. **Resolve and validate everything before any marker is written:**
   - Finago credentials present.
   - `shop_settings.accounting` valid; provider has a clearing account.
   - Every priced line has an account, VAT code and department — from the
     snapshot, else from the product's current sales type (for orders placed
     before this change, e.g. the stranded one).
   - Lines balance to the order total.
   On any failure: release the claim, return `not_configured` with the reason
   logged. The sweep retries after the gap is fixed.
5. Write the `"posting"` marker.
6. `POST /transactions`. On success write the transaction id; on failure leave
   the marker for manual recovery (unchanged — the only remaining
   "maybe posted" zone).

`packages/connectors/.../rest/transactions.ts` becomes pure transport plus a
pure `buildShopTransactionInput` that takes resolved lines, clearing account,
transaction type and campus — it reads no env and no settings. The refund
builder takes the same inputs with signs flipped.

## Refunds

- `order-refunds.ts` allocation entries carry `accountNumber`, `vatCode` and
  `departmentId`, stored in `order_refunds.ledger_allocation`. Entries from
  before this change fall back to the account's current VAT code and the
  product's department.
- The reversal credits the clearing account and debits each revenue line with
  the same VAT code and dimensions.
- The payout voucher's "refusjoner" debit on 1530 clears it.
- Orders whose `finago_transaction_id` is a sentinel — `membership`,
  `posting`, `zero-total`, `wordpress-import` — get no automatic reversal.
  WordPress-era sales were booked by hand in the monthly report.

## Error handling and visibility

- `not_configured` and `disabled` never strand an order; the API cron retries.
- A stranded `"posting"` marker is visible on the admin order detail page
  (ledger state), with the order id in the Finago voucher comment.
- The API cron response reports posted / not_configured / failed counts.

## Testing

- **connectors (`bun test`):** `buildShopTransactionInput` balances to zero,
  groups by (account, VAT, department), dimension shape `{dimensionType, value}`,
  clearing account per provider, refund builder mirrors exactly.
- **shared (vitest):** snapshot vs product fallback; every `not_configured`
  cause releases the claim and writes no marker; `disabled` claims nothing;
  memberships excluded; settings zod schema.
- **api (vitest):** return route (web redirect, app deep link, cancelled/failed
  paths, settle called once), cron route auth + passes, checkout snapshot.
- **admin (`bun test`):** publish gate; sales-type actions role gate
  (global + campus admin allowed, department denied).
- **web (vitest):** `verifyOrder` calls the API app.
- No test writes to Finago. The first live voucher is the stranded order,
  posted under supervision.

## Rollout

1. Implement on a feature branch; `bun run check-types`, tests, and
   `bun run build --filter=admin` pass.
2. Accountant confirms: VAT on sweaters/vests/camera; fees are booked only on
   payout vouchers from now on; fines on 3150 vs 3900.
3. Schema: create `sales_types`; add `webshop_products.sales_type`,
   `order_items.finago_vat_code`, `order_items.finago_department`,
   `ledger_accounts.vat_code`; push with the Appwrite CLI and regenerate
   `packages/api/types/appwrite.ts`.
4. Deploy api. Point `ORDERS_RECONCILE_URL` at the API route.
5. Deploy web and admin. Remove `TFSO_SHOP_TRANSACTION_TYPE_NUMBER` and
   `TFSO_VIPPS_RECEIVABLE_ACCOUNT` from web and api env. Keep the SOAP
   credentials on web for now: `src/lib/actions/membership.ts` still uses them
   (listed under follow-ups).
6. In admin: sync ledger accounts, review seeded sales types, save shop
   posting settings (flag still off).
7. Assign sales types to products with a one-off script (dry run → review →
   write). Proposed mapping below.
8. Recover `6aa19747003c79019977`: reset `finago_transaction_id` to null and
   `finago_posting_lock` to 0, enable `shop_ledger_posting`, let the cron post
   it, verify the voucher in Finago.
9. Watch the first live orders; confirm 1530 returns to ≈0 after the next Vipps
   payout voucher. Verify the first Stripe order and payout against 1540.
10. Delete the web return shim one week after step 5.

### Proposed product mapping

**Egenandel (3100):** Avslutningsfest 23. mai; Blåtur; Blåtur NU; Børsgruppen
(egenandel reise); Delbetaling 2 ØKAD linjetur; Styret ØKAD linjetur;
egenadel hyttetur fadderullan; Egenandel hyttetur Karrieredagene; KD hyttetur
egenandel; NU hyttetur Trysil; Hyttetur Makroøkonomisk utvalg – Hemsedal;
overlapstur; Egenandel Overlapps tur Stavanger; Egenandel – Investment;
Ownshare debate; Linjetur forretningsjus; innbetaling forretningsjus;
Utenlandstur HR delbetaling 1; Finans & HR linjetur Milano 2026 delbetaling 2;
HR linjetur Milano 2026; HR to Paris payment 1 and 2; EMS Linjetur Styret 1
and 2 (drafts); Extra fee for individual hotel room (draft); the 16
person-named personal deductibles under OSL Bergensbaneløpet (406–1 839 kr,
confirmed deductibles, not tickets); Oliver Wolt (personal deductible,
Stavanger).

**Varesalg (3000) — pending accountant:** Gensere til børsgruppen; Sivøk
genser S/M/L/XL; Egenandel – BISO genser Trondheim 2025; Egenandel – BISO
vester Trondheim 2025; Egenandel Vest Stavanger; Egenandel –
Regnskaps-halvglidelås; salg av kamera – biso media.

**Bokskapleie (3620):** Bokskap – Campus Trondheim; both Booklocker – Campus
Oslo drafts.

**Annet avgiftsfritt (3150):** Bot etter tur.

**Archive:** BISO Membership (legacy WordPress draft); test (draft).

## Out of scope / follow-ups

- Other web code that calls third parties (SharePoint document download,
  varsling SMTP, BI identity sync, 24SO membership sync in
  `src/lib/actions/membership.ts`) — move behind the API app separately.
- Expense posting env (`TFSO_EXPENSE_TRANSACTION_TYPE_NUMBER`,
  `TFSO_SUPPLIER_DEBT_ACCOUNT`) can move to the Regnskap page later. Note that
  expense posting uses `tax_code` as a posting tax number, while
  `ledger_accounts.tax_code` holds the Finago tax id.
- Automating payout clearing (Vipps Report API, Stripe payouts) — not needed;
  payouts are already booked in Finago.
- Finago credentials in an encrypted admin-managed table (like
  `payment_settings`).
