# Membership status via `apps/api` — design

## Problem

A student is a member when their 24SevenOffice (Finago) customer holds a
membership CRM category. Three surfaces sell memberships:

1. **The website** (`apps/web`) — checkout already runs through `apps/api`
   (`/api/payment/{provider}/membership-checkout`); fulfilment invoices in
   Finago and assigns the category (`fulfilMembershipOrder`).
2. **Our Flutter app** — reads status from `apps/api` `/api/membership`.
3. **BI's Student app** — built by BI; writes the category to Finago outside
   our code. We get no notification.

Today `apps/web` and `apps/api` each run `computeMembershipStatus()` (Finago
SOAP call + `memberships` catalog match) behind their **own** 10-minute
`unstable_cache`. Neither cache is invalidated when a purchase is fulfilled, so
a student who just paid can be told "not a member" for up to ten minutes, and
the two surfaces can disagree with each other.

## Goals

- Finago stays the only source of truth for *who* is a member. No per-student
  membership records in the database. (The `orders` row that tracks payment
  and invoicing, and the `memberships` catalog that maps a category to its
  name and season dates, are unchanged.)
- `apps/api` is the only place membership status is computed and cached. The
  website reads it from there, like the Flutter app does.
- A purchase we fulfil (web or Flutter) is visible immediately — member pass,
  prices, gates.
- A purchase made in BI's Student app is visible within 60 seconds.

## Decisions

| Question | Decision |
|---|---|
| Freshness for purchases we can't observe (BI app) | 60s cache TTL in `api`; our own fulfilments invalidate instantly |
| `api` deployment | Appwrite Sites, standalone build, **single instance** — `revalidateTag` in `api` clears the only cache there is |
| How `web` calls `api` | Server-to-server with the student's session JWT (`createSessionJwt`), same pattern as `startMembershipCheckout` |
| Endpoint shape | Slim `?view=status` mode on the existing `/api/membership`, not a new route |
| Deprecated `web` `cron/reconcile-orders` | Out of scope; left for the follow-up already noted in its header |

## Architecture

```
web page / route ──► web lib/actions/membership.ts
                        │ local pre-checks (session, student_id)
                        │ React cache() per request
                        ▼
                     GET {API}/api/membership?view=status[&refresh=1]
                     Authorization: Bearer <session JWT>
                        ▼
                     api membership-status-cache.ts (60s unstable_cache)
                        ▼ on miss
                     computeMembershipStatus()  ──►  Finago GetCustomerCategories
                                                ──►  app.memberships catalog

payment callback / return / order poll / reconcile cron  (all in api)
   └─► settleOrder() ──► settleOrderIfPaid() ──► fulfilMembershipOrder()
                     └─► invalidateMembershipStatus(studentNumber)
```

## Components

### `packages/shared`

- `utils/membership-fulfilment.ts` — `fulfilMembershipOrder` includes
  `studentNumber` in its success result:
  `{ fulfilled: true, invoiceId, studentNumber }`. The package stays free of
  Next.js cache APIs; it only reports who was fulfilled.
- `utils/order-settlement.ts` — `settleOrderIfPaid` returns
  `{ membershipStudentNumber?: number }` (set only when a membership order was
  fulfilled on this call) instead of `void`. It still never throws.
- `utils/membership-gate.ts` — add `api_unavailable` to
  `TRANSIENT_STATUS_REASONS`.

### `apps/api`

- `src/lib/membership-status-cache.ts`
  - `MEMBERSHIP_CACHE_TTL_SECONDS` = 60.
  - New `invalidateMembershipStatus(studentNumber)`: runs
    `revalidateTag(membershipCacheTag(studentNumber), { expire: 0 })` and
    deletes the student's `recentFailures` entry.
  - Replace the "two separate caches" comment with one describing the new
    arrangement (single cache, invalidated on fulfilment, 60s bound for
    purchases made outside our system).
- New `src/lib/settle-order.ts` — `settleOrder(orderId, db)` calls
  `settleOrderIfPaid` and, when it returns a `membershipStudentNumber`, calls
  `invalidateMembershipStatus`. Used by:
  - `src/app/api/payment/return/route.ts`
  - `src/app/api/payment/[provider]/callback/route.ts`
  - `src/app/api/payment/orders/[orderId]/route.ts`
- `src/app/api/cron/reconcile-orders/route.ts` — after
  `fulfilMembershipOrder` returns `fulfilled: true`, call
  `invalidateMembershipStatus(result.studentNumber)`.
- `src/app/api/membership/route.ts` — `?view=status`:
  - Same bearer auth, profile read and student-number sanitising as the full
    overview.
  - Returns the raw `MembershipStatus` (`checkedAt` as epoch ms), with no
    catalog read, gate or campus list.
  - No student number → `emptyMembershipStatus("no_student_id" |
    "invalid_student_id")`; profile read failure →
    `emptyMembershipStatus("profile_unavailable")`.
  - `refresh=1` behaves as on the full view (per-student 60s floor).
  - Without `view=status` the response is unchanged, so the Flutter app is
    unaffected.

### `apps/web`

- `src/lib/actions/membership.ts` — same exports, new internals:
  - `getMembershipStatus()`: local pre-checks via `getLoggedInUser()` (no
    session → `not_authenticated`; no/invalid `student_id` → matching reason,
    no HTTP call), then `GET ${NEXT_PUBLIC_API_BASE_URL}/api/membership?view=status`
    with the session JWT, `cache: "no-store"`, 5s timeout. Wrapped in React
    `cache()` so layout and page share one call per request.
  - `refreshMembershipStatus()`: same, with `&refresh=1`.
  - `getLiveMembershipStatus()`: the refresh read. Gates (cart, orders, jobs)
    keep calling it unchanged.
  - Removed: `unstable_cache`, the 10-minute TTL, `revalidateTag`, and the
    direct use of `computeMembershipStatus` / Finago.
  - `connection()` and `unstable_rethrow` handling stay, so prerendering and
    Next.js control-flow signals behave as today.
- `src/app/api/membership/route.ts`, `membership-provider.tsx`, member pass
  and all page call sites are unchanged.

## Error handling

Web's response mapping for the `api` call:

| Outcome | Web returns |
|---|---|
| `200` with a valid status body | the status as-is, including any transient reason from `api` (`finago_error`, `unexpected_error`, `profile_unavailable`) |
| `401` | `not_authenticated` |
| network error, timeout (5s), other non-2xx, unparseable body | `api_unavailable` |
| no session JWT | `not_authenticated` |

`api_unavailable` is transient, so the existing logic treats it as "couldn't
check", not "not a member": gates don't refuse, web's `/api/membership` answers
503 and `membership-provider` keeps its last status, and the member pass shows
its unavailable state.

Web caches nothing, failures included; `api`'s `recentFailures` already holds
Finago retries to one per student per minute.

The student number is always resolved by `api` from the authenticated user; web
never sends it, so a request cannot read another student's status.

## Behaviour after the change

| Event | Visible in web + Flutter |
|---|---|
| Web or Flutter purchase fulfilled via callback/return/order poll | immediately (cache invalidated in the same request) |
| Fulfilment recovered by `api` reconcile cron | immediately after the cron run |
| Fulfilment recovered by deprecated `web` reconcile cron | within 60s (TTL) |
| Category added by BI Student app | within 60s (TTL); a gate refusal lasts at most the 60s refresh floor |
| Finago outage | "couldn't check" everywhere, never "not a member" |

## Testing

Vitest, next to the existing `*.test.ts` files.

- `apps/api/src/lib/membership-status-cache.test.ts` — invalidation clears the
  cached status and the failure-throttle entry; TTL is 60s.
- `apps/api/src/app/api/membership/route.test.ts` — `view=status` returns the
  raw status; 401 without/with bad bearer; no-student-id and invalid-id
  reasons; profile read failure → `profile_unavailable`; `refresh=1` passes
  through; the full view is unchanged.
- `apps/api/src/lib/settle-order.test.ts` — invalidates when a membership was
  fulfilled; does not when nothing was fulfilled or the order is not a
  membership.
- `apps/api/src/app/api/cron/reconcile-orders/route.test.ts` — a successful
  fulfilment invalidates; an unsuccessful one does not.
- `packages/shared` fulfilment/settlement tests — `studentNumber` /
  `membershipStudentNumber` present on success only.
- `apps/web/src/lib/actions/membership.test.ts` — rewritten around a mocked
  `fetch`: anonymous and no-student-id short-circuit without fetching; 200
  pass-through; 401 → `not_authenticated`; timeout, 5xx and bad JSON →
  `api_unavailable`; one fetch per request; refresh sends `refresh=1`.
- Verification: `bun run check-types`, and the web and api test suites.

## Out of scope

- Deleting `apps/web/src/app/api/cron/reconcile-orders` (tracked in its own
  header comment).
- Flutter app changes — it already calls `api` and keeps the full overview.
- Push notification from 24SevenOffice for BI-app purchases (no such hook).
