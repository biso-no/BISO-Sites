# Membership Purchase Design

## Goal

Make it possible to actually buy a BISO membership on `apps/web`. Today every
membership CTA points at `/shop/membership/`, which does not exist. Students can
read about membership and see benefits, but there is no purchase path.

This design adds a tailored membership purchase flow — deliberately separate
from the general webshop, because memberships carry requirements no other
product has:

- the buyer must be authenticated (no guest checkout);
- the buyer must have linked their BI student account through the OIDC
  connector, not merely signed in with a student email;
- the buyer's BI campus must be captured explicitly;
- the purchase must be registered in Finago (24SevenOffice) as a customer,
  a customer category, and an invoice.

The web app is a **backup** purchase channel. BI's own student app remains the
primary one. Both write into the same Finago records, so this flow must produce
records indistinguishable from the ones the BI app produces.

## Source of truth

**Finago is the sole source of truth for membership.** Membership is never
stored as state in Appwrite. If a member is added by hand in Finago, they are a
member here as soon as the cache expires. The check is a live Finago read,
cached server-side for ten minutes keyed by the student's numeric id, resolved
once per render at layout level.

This already exists as `getMembershipStatus` in
`apps/web/src/lib/actions/membership.ts`. This design keeps it and makes it the
only implementation (see "Consolidation").

## Reference implementation

`https://github.com/biso-no/funksjon` is an existing, production-proven Next.js
tool that performs the Finago side of this work for manual and CSV-driven member
creation. Its behaviour is authoritative wherever this repo and it disagree.

Values taken from it:

| Plan | Price (NOK) | 24SO ProductNo | 24SO ProductId | 24SO CategoryId | Accrual months |
|---|---|---|---|---|---|
| Semester | 350 | 1009 | 54 | 113176 | 6 |
| 1 year | 550 | 2004 | 71 | 113178 | 12 |
| 3 years | 1350 | 3004 | 82 | 113177 | 36 |

`ProductNo` and `ProductId` are distinct 24SO fields. **Invoice rows take
`ProductId`.** funksjon's `productIdMap` (`1009 → 54`, `2004 → 71`,
`3004 → 82`) is that `No → Id` translation, not an internal indirection.

Campus → 24SO `DepartmentId`: Oslo 1, Bergen 300, Trondheim 600, Stavanger 800,
National 1000.

Campus ids are the Appwrite campus row ids `"1"`–`"5"` in that same order.

These IDs are read from the `memberships` table at runtime (see "Catalog"); the
table above records what the values are expected to be, for review and for
verifying the sync.

The catalog already holds the right value and needs no additional column:
`syncMembershipsFrom24SO` writes `membership_id` from `product.Id`, which is the
`ProductId` invoice rows require. `product.No` is read into the sync item but
never persisted, which is correct — nothing in this flow uses `ProductNo`.

## Current state

Already built and reused as-is:

- live Finago membership check with per-student cache tags
  (`apps/web/src/lib/actions/membership.ts`);
- the 24SevenOffice connector: session auth with DB-cached tokens, company
  lookup/create, customer categories, invoice create, product sync
  (`packages/connectors/src/24sevenoffice/`);
- Vipps ePayment and Stripe checkout with server-side trusted repricing
  (`apps/api/src/app/api/payment/[provider]/checkout/route.ts`,
  `packages/payment/`);
- order lifecycle, claim-locked Finago ledger posting, and a reconciliation cron
  (`packages/shared/utils/finago-order-posting.ts`,
  `apps/web/src/app/api/cron/reconcile-orders/route.ts`);
- OIDC "Link BI Student" buttons in the profile and onboarding surfaces.

Gaps this design closes:

- nothing ever writes `student_id` onto the user profile after the OIDC link, so
  the live membership check always resolves `no_student_id`;
- a second, competing membership check exists via a legacy
  `verify_biso_membership` Appwrite Function;
- no purchase route, no plan selection, no campus capture;
- `syncMembershipTo24SO` is dead code, is never called, and never creates an
  invoice;
- `createMembershipInvoice` omits everything the BI app's invoices carry:
  accrual, user-defined dimensions, payment terms, addresses, distributor.

## Defects found in existing code

Both would fail silently and are fixed as part of this work.

**`saveCustomerCategories` has Key and Value inverted.** It sends
`{ Key: companyId, Value: categoryName }`. funksjon sends
`{ Key: categoryId, Value: customerId }`, and this repo's own
`getCustomerCategoryTree` parser documents `Key = CategoryId, Value = CompanyId`.
The read path and the write path disagree with each other. The write path is
wrong. The signature also changes from `string[]` category names to `number[]`
category ids, which is what the API and the `memberships.category` column
actually hold.

**Created customers get a Finago-assigned customer number.** `saveCompany` and
`createStudentCustomer` never send `Id`. This design requires the customer
number to *be* the Azure employee id, so `Id` must be sent explicitly on create.

Separately, `syncMembershipsFrom24SO` writes `price: 0` on every upsert despite
already fetching `product.Price`, and re-writes `canPurchase: false` on every
update — so an administrator can never mark a plan sellable, and the value is
silently reverted on the next sync.

## Schema changes

Added to `packages/api/appwrite.config.json` in this repo, pushed by the owner
with `appwrite push tables`, then types regenerated with
`appwrite types -l ts ./types`.

| Table | Column | Type | Required | Purpose |
|---|---|---|---|---|
| `user` | `bi_employee_id` | string(32) | no | Azure `employeeId`. This is the Finago CustomerId. |
| `user` | `bi_campus_id` | string(8) | no | BI campus id `"1"`–`"5"`. Distinct from `campus_id`, which is a site display preference. |
| `user` | `bi_linked_at` | datetime | no | When the OIDC link plus Azure enrichment last succeeded. Drives re-sync. |
| `orders` | `membership_invoice_id` | string(64) | no | 24SO invoice `OrderId`, and the in-flight marker. Idempotency. |
| `orders` | `membership_fulfilment_lock` | integer | no | Atomic claim counter, mirroring `finago_posting_lock`. |

`user.student_id` already exists and is reused. It stores the email local part
as issued by BI (`s1715738`), because the member portal renders it directly and
reconstructs `s1715738@bi.no` from it. Every Finago call sanitizes it to digits
(`1715738`) at the call site, which is what `getMembershipStatus` already does.

The legacy `student_id` relation table and `user.studentId` relation are left
untouched. `user.student_id` is the canonical field for this flow.

## Environment variables

New, server-only, needed by `apps/web` and `apps/api`, and added to the
`turbo.json` build env allow-list:

- `BI_AZURE_TENANT_ID`
- `BI_AZURE_CLIENT_ID`
- `BI_AZURE_CLIENT_SECRET`

These address BI's Azure tenant through the owner's app registration there. They
are separate from the existing `AZURE_*` variables, which address BISO's own
tenant. The app registration needs `User.Read.All` (application permission) with
admin consent, and the directory must expose `employeeId`.

## Components

### 1. BI identity enrichment

New server action `syncBiStudentIdentity()` in
`apps/web/src/lib/actions/bi-identity.ts`.

Appwrite only supports account linking client-side, so the existing
`clientAccount.createOAuth2Session(OAuthProvider.Oidc, …)` call is kept. What is
missing is the return leg. On redirect back with `?linked=1`, the page invokes
this action.

1. `account.listIdentities()`, find the identity whose `provider` is `oidc`.
2. Take `providerEmail` (falling back to `providerUid` when it parses as an
   email). Reject anything not ending in `@bi.no`.
3. Write the local part to `user.student_id`.
4. Look the student up in BI's Azure tenant by that email. Read `employeeId`
   into `user.bi_employee_id`, and read `officeLocation`/`department` as a
   campus *hint* only.
5. Stamp `bi_linked_at`. Invalidate the `membership:<numericId>` cache tag so
   status reflects reality immediately.

Writes use the admin client. These columns are deliberately outside
`PROFILE_WRITABLE_FIELDS` — they are identity assertions, not user-editable
profile data.

Returns a discriminated result carrying `studentId` and whether an
`employeeId` was found. A missing `employeeId` is not a link failure: the link
succeeds, the profile is flagged incomplete, and purchase is blocked before any
payment is taken.

New connector export `getBiDirectoryUser(email)` in
`packages/connectors/src/azure/` instantiates a second `GraphUserService` with
the BI-tenant credentials. `GraphUserService` already takes
`(tenantId, clientId, clientSecret)` and already selects `employeeId`, so this
is a thin wrapper, not a new client.

### 2. Catalog

New `getMembershipPlans()` reads the `memberships` table for rows where
`status === true && canPurchase === true`.

A plan is:

```ts
interface MembershipPlan {
  accrualMonths: 6 | 12 | 36;
  categoryId: number;      // 24SO customer category
  duration: "semester" | "year" | "three_years";
  expiryDate: string;
  id: string;              // Appwrite row id
  name: string;
  price: number;
  productId: number;       // 24SO ProductId, from membership_id
  startDate: string;
}
```

`duration` and `accrualMonths` derive from the parsed start and expiry dates
already produced by `parseStartDate`/`parseExpiryDate` in `membership-sync.ts`,
rounded to the nearest of 6, 12, or 36 months. The plan therefore survives the
annual product rollover without a code change.

`syncMembershipsFrom24SO` is fixed to write the real `product.Price` and to
preserve administrator-set `price` and `canPurchase` on update rather than
resetting them.

### 3. Purchase route

New `/membership/join` under `(public)`, because it must render its own
signed-out state rather than bouncing to the 401 interrupt. `/shop/membership`
redirects to it so every existing CTA keeps working unchanged.

The server component resolves gate state once and renders exactly one of:

| State | UI |
|---|---|
| signed out | sign-in CTA carrying `redirectTo=/membership/join` |
| no `student_id` | "Link your BI student account", triggering the OIDC flow |
| linked, no `bi_employee_id` | "We couldn't verify your BI record" — retry sync, plus a contact route |
| already an active member | current status and expiry; only plans whose expiry date is later than the current membership's expiry are offered |
| eligible | the wizard |

The wizard is a client component: plan cards from the catalog → campus select →
payment method. Campus is required and prefills from `bi_campus_id`, then the
Azure hint, then the site campus cookie; it is always editable, so a student who
has transferred campus can correct it.

Vipps is presented as the primary method, card (Stripe) as secondary, each
hidden when its feature flag is off.

Submission calls `startMembershipCheckout({ planId, campusId, provider })`,
which re-verifies authentication, `student_id`, and `bi_employee_id`, validates
the plan is still purchasable, persists `bi_campus_id`, mints a JWT, and posts
to the API app. It fails closed on every check.

### 4. Membership checkout endpoint

New `apps/api/src/app/api/payment/[provider]/membership-checkout/route.ts`,
following the shape of the existing product checkout route: JWT authentication,
payment-provider feature flag, CORS helpers, admin client for writes.

It does not trust the client for price or plan. It re-reads the plan from
`memberships`, re-reads `student_id` and `bi_employee_id` from the profile, and
rejects with 409 if either is absent.

The order is created through the existing `createOrder` with `campus_id` set to
the selected BI campus and a single `items_json` line marked
`product_type: "membership"`, carrying `membership_id`, `category_id`,
`duration`, `accrual_months`, and the plan name. That marker is what
`hasMembershipProduct` already looks for, and what routes the order to
membership fulfilment rather than shop ledger posting.

Vipps and Stripe session creation, the return URL, and
`updateOrderWithSession` are unchanged from the product path.

### 5. Fulfilment

New `packages/shared/utils/membership-fulfilment.ts` exporting
`fulfilMembershipOrder(orderId, db)`.

Idempotency uses the same claim-lock pattern as `postFinagoTransactionForOrder`:
atomic `incrementRowColumn` on `membership_fulfilment_lock`, an in-flight marker
written to `membership_invoice_id` before any Finago call, the real invoice id
written on success, and the claim released only when the failure happened
*before* the external side effect. A failure after the Finago call leaves the
marker in place and the order surfaces for manual recovery — it is never
retried automatically, because a retry could double-invoice.

Steps:

1. Load the order. Require status `paid` or `authorized`, require a membership
   line, bail if `membership_invoice_id` is already set.
2. Claim the lock.
3. Resolve the Finago customer: by `CompanyId` = employee id; failing that by
   `ExternalId` = sanitized student number; failing that create one with `Id`
   set explicitly to the employee id, `ExternalId` set to the student number,
   `Name` as `(Student) LastName, FirstName`, `Type: Consumer`, `Private: true`,
   `Country: NO`, `CurrencyId: NOK`, and the buyer's email.
4. Assign the plan's category id to the customer, skipping it if already
   present.
5. Create the invoice.
6. Write the invoice id and invalidate `membership:<numericId>`.

The invoice mirrors funksjon's payload exactly, except where noted:

- `OrderStatus: "Invoiced"` — the student has already paid by Vipps or Stripe,
  so unlike funksjon's manual tool there is nothing left for finance to collect;
- `PaymentMethodId: 1`, `PaymentTime: 0`, `Distributor: "Manual"`;
- empty `Delivery` and `Invoice` addresses with `Country: NO`;
- `DateInvoiced` today, `PaymentAmount` the plan price;
- `DepartmentId` from the campus map, set at both order and row level;
- one `InvoiceRow` with the plan's `ProductId`, price, quantity 1;
- `AccrualDate` and `AccrualLength`;
- `UserDefinedDimensions` at both order and row level: `TypeId 101` carrying the
  campus (`Name` = campus name, `Value` = campus id) and `TypeId 102` carrying
  the membership (`Name` = `"100"`/`"200"`/`"300"` by duration, `Value` =
  `"Semester"`/`"Year"`/`"3 Years"`).

`AccrualDate` derives from the plan's parsed `startDate` rather than funksjon's
hardcoded `2026-07-01`, so it does not rot at the next semester rollover.

Fulfilment is triggered from all three paths that already observe payment
settlement — the Vipps webhook callback, `/api/checkout/return`, and the
reconcile-orders cron — because each can be the first to see a paid order. The
claim lock makes concurrent triggers safe.

`postFinagoTransactionForOrder` skips membership orders, so revenue is recorded
once as an invoice and never also as a shop ledger transaction.

### 6. Consolidation

The live Finago check moves from `apps/web/src/lib/actions/membership.ts` into
`@repo/shared` so both apps share one implementation, keeping the existing
cache-tag strategy, the non-cached transient-failure signalling, and the
`connection()` boundary that keeps it out of prerender.

`checkMembership()` in `packages/shared/utils/membership.ts` is reimplemented on
top of it. The `verify_biso_membership` Appwrite Function is no longer executed
from anywhere: not the member portal, not `getMemberDiscountIfAny` in
`apps/web/src/app/actions/orders.ts`, not its twin in the API checkout route.

Those two discount paths currently resolve `profile.studentId.student_id` via
the relation; they switch to the canonical `user.student_id`.

## Error handling

| Failure | Behaviour |
|---|---|
| Not signed in, or BI account not linked | Purchase never starts; the gate renders the relevant CTA. |
| `employeeId` absent from BI's directory | Purchase blocked before payment. Retry-sync affordance plus a contact route. No money is taken. |
| Graph unavailable during link | Link succeeds, enrichment marked incomplete, retriable. |
| Finago unreachable during the status check | `MembershipComputationError` keeps the failure out of the cache; the user is treated as a non-member for that read only. Existing behaviour, retained. |
| Payment fails or is abandoned | Order stays `pending`. No Finago writes. |
| Fulfilment fails before the Finago call | Claim released, retried by the reconcile cron. |
| Fulfilment fails after the Finago call | Marker retained, no automatic retry, surfaced for manual recovery. |
| Plan withdrawn between selection and checkout | Checkout endpoint rejects; no order created. |

## Testing

Vitest, colocated `*.test.ts`, matching existing convention.

- student email → student number parsing, including rejection of non-`@bi.no`
  addresses and of a missing OIDC identity;
- plan mapping: product name → duration, accrual months, start/expiry;
- catalog sync: real price is carried, administrator `canPurchase` survives an
  update;
- category pair shape — a regression test pinning `Key = categoryId,
  Value = customerId`;
- invoice payload builder: department per campus, both dimension pairs at both
  levels, accrual date derived from plan start, and `ProductId` (not `ProductNo`)
  on the invoice row;
- customer create sends `Id` equal to the employee id;
- fulfilment idempotency across `already_posted`, `claimed_elsewhere`,
  `not_paid`, and the post-side-effect failure that must not release the claim;
- gate resolution for each of the five states;
- checkout endpoint rejects a client-supplied price and a withdrawn plan.

Finago and Graph are mocked throughout. No test performs a live call.

## Out of scope

- Changing how the BI student app purchases memberships.
- Membership refunds, cancellation, or transfer between campuses.
- Backfilling `bi_employee_id` for users who linked before this change; they are
  enriched on their next link or purchase attempt.
- Admin CMS surfaces for membership orders beyond what already exists.
- Retiring the legacy `student_id` relation table.

## Owner actions

1. Create the BI-tenant app registration credentials and set `BI_AZURE_*` in
   `apps/web` and `apps/api` environments.
2. Grant `User.Read.All` application permission with admin consent in BI's
   tenant, and confirm `employeeId` is populated for students.
3. `appwrite push tables` for the five new columns, then
   `appwrite types -l ts ./types`.
4. Set `price` and `canPurchase` on the three `memberships` rows after the sync
   fix lands.
5. Verify against a Finago test customer that the invoice this flow produces is
   indistinguishable from one the BI app produces.
