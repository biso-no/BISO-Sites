# BISO-Sites — Production Readiness Review (Runtime Focus)

_Prepared for the launch this week. Scope: runtime correctness, data integrity,
access control, and deploy/config — not code style. Findings were produced by
targeted deep-dives across payments, web, admin, the API service, connectors,
and deploy/env, and the critical items were re-verified by hand against source._

## Build & type status

- `bun run build` — **passes** for `web`, `admin`, and `api` (all launch-critical apps) and every package.
- `bun run check-types` — **passes** everywhere except `docs`, which fails only on Fumadocs-generated modules (`collections/server`, `public/logo.png`). Not launch-relevant, but it does mean `docs` won't build until regenerated.
- Note: `apps/web` has `typescript.ignoreBuildErrors: true`, so its `next build` does **not** catch type regressions — `check-types` is the only signal there.

---

## LAUNCH BLOCKERS — fix before releasing

### 1. Every CMS (block-editor) page crashes at render
`apps/web/src/app/(public)/[...slug]/_components/rendered-page.tsx:28-29`

`BlockRenderer` is a **server** component (no `"use client"`, rendered by the server catch-all `page.tsx`). It passes `onPatch={noopPatch}` — a plain function — into `def.Render`, which for all 33 blocks is a `"use client"` component. Passing a function prop across the server→client boundary is a hard React Server Components serialization error (`"Functions cannot be passed directly to Client Components…"`). So **every** published page served by the catch-all renders `(public)/error.tsx` ("Something went wrong") instead of content, on every request.

`generateMetadata` doesn't render blocks, so link previews/titles still work — this is why it can pass casual testing. **Confirm with one `next build && next start` request to a real published page.**

_Fix:_ make `onPatch` optional in `BlockDefinition` and omit it for read-only rendering, or make `BlockRenderer` a client component.

### 2. First real checkout 500s — `APPWRITE_ORDERS_COLLECTION_ID` has no fallback and is undocumented
`packages/shared/utils/vipps-order-ops.ts:104-105` (+ ~24 sites) and `finago-order-posting.ts:38-39`

These use `process.env.APPWRITE_ORDERS_COLLECTION_ID!` / `APPWRITE_DATABASE_ID!` with a non-null assertion and **no fallback**, while the sibling `packages/payment/src/vipps/index.ts:221-222` uses `?? "app"` / `?? "orders"`. `APPWRITE_ORDERS_COLLECTION_ID` is present in **neither** `apps/web/.env.example` nor `apps/api/.env.example` (only `APPWRITE_DATABASE_ID` and `APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID` are). An operator following `.env.example` will miss it → `createRow(undefined, undefined, …)` → AppwriteException at request time. This crashes exactly and only the money path: order creation, the Vipps callback, the checkout-return route, and stock decrements. Flagged independently by two reviewers.

_Fix:_ either set `APPWRITE_ORDERS_COLLECTION_ID=orders` / `APPWRITE_DATABASE_ID=app` / `APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID=webshop_products` on **both** web and api sites, or (better) replace the `!` assertions with the same `?? "orders"` / `?? "app"` defaults used elsewhere. Also add these three to `turbo.json#tasks.build.env`.

### 3. Stripe failed payment is recorded as success → oversell + phantom revenue
`packages/shared/utils/stripe-pure.ts:47-56` + `apps/api/src/app/api/payment/[provider]/callback/route.ts:21-26`

`determineStatusFromStripeSession` returns `AUTHORIZED` for `status:"complete"` + `payment_status:"unpaid"` — which is exactly the shape of a `checkout.session.async_payment_failed` event (and the callback explicitly subscribes to it). `AUTHORIZED` is treated as fulfilled: stock is decremented, the buyer is redirected to `?success=true`, and Finago revenue is posted. There is no failure mapping and no Stripe reconcile cron to undo it. Any delayed-notification payment method that fails leaves a permanently "fulfilled" order with stock gone, revenue booked, and no money received.

_Fix:_ map `payment_status:"unpaid"` (or the `async_payment_failed` event) to a failed/cancelled status; do not treat `AUTHORIZED` as revenue-posting for Stripe.

### 4. Payments default to TEST mode when a `payment_settings` row exists
`packages/payment/src/credentials/select.ts:29`

`const testMode = row.test_mode ?? true` — whenever a settings row is present, test mode is the default and `VIPPS_TEST_MODE` is ignored. Launch with the row still on defaults and real customers hit Vipps/Stripe **test** rails and cannot pay.

_Fix:_ explicitly flip `payment_settings.test_mode` to live and verify one real payment. Re-register the Vipps webhook against the live callback afterward. (Also remove the DEBUG `console.log`s that print secret-presence booleans in `apps/admin/src/app/(portal)/payment-settings/actions.ts:205-236` and `apps/api/.../webhooks/register/route.ts`.)

### 5. API checkout route does no stock or purchase-limit validation
`apps/api/src/app/api/payment/[provider]/checkout/route.ts:338-433`

`ensureStockAvailability` / `ensurePurchaseLimit` live only in the web server action (`apps/web/src/app/actions/orders.ts:409-421`). The API route accepts any Appwrite JWT — and anyone can mint one from an anonymous session. A direct `POST /api/payment/stripe/checkout` with `quantity: 50` on a `stock: 5` drop creates the order and captures payment; the decrement then floors at 0 and logs "OVERSELL … Manual follow-up required." Per-customer limits are bypassable the same way.

_Fix:_ enforce stock and purchase-limit checks server-side inside the API checkout route, not only in the web action.

### 6. Unauthenticated staff-directory endpoint + OData filter injection
`apps/api/src/app/api/campus/[campusId]/[departmentId]/board/route.ts:79-151`

`GET` has **no auth check**, uses `createAdminClient()` + Graph, and returns every matching enabled account's name, email, phone, and photo. For a non-numeric `departmentId` the URL param is interpolated raw into the Graph `$filter` (line 138: `startswith(department, '${departmentName}')`), so a crafted segment can break out of the intended predicate and broaden/enumerate results. Unauthenticated PII exposure at minimum, OData injection at worst.

_Fix:_ confirm whether this is meant to be public; regardless, reject quotes/validate `departmentId` before interpolation, and add auth if it isn't intentionally public.

### 7. Department users can self-publish pages, bypassing the approval gate
`apps/admin/src/app/(portal)/_actions/pages.ts:203-227`

`publishPageAction` / `unpublishPageAction` call `pbPublishPage` directly with only `requireAuth()` — no `assertPublishAccess(ctx, campusId)`, unlike events/jobs/news/drafts. Because `savePageDraft` grants row-level update to the owning **department team**, `publishPage` (which uses the RLS-scoped session client) succeeds for a plain department-role user. They can push a page live to the public site — an action they're explicitly barred from for every other content type.

_Fix:_ load the page's `campus_id` and call `assertPublishAccess` before publishing, and wrap these three actions in `try/catch` (they currently have none → opaque error digests for editors).

### 8. `NEXT_PUBLIC_BASE_URL` unguarded on the payment-return hot path
`apps/web/src/app/api/checkout/return/route.ts:60-83,137-139`

Every redirect does `new URL(path, process.env.NEXT_PUBLIC_BASE_URL)` with no fallback, and the catch block repeats the same call. If the var is missing/empty at runtime, every buyer returning from Vipps/Stripe gets `ERR_INVALID_URL` → raw 500 **after paying**. Related build-time bakes (see config section): `NEXT_PUBLIC_API_BASE_URL` falls back to `http://localhost:3003` in the browser bundle (expense/shop API calls dead for real users), `team-tab.tsx:156` bakes `"undefined/api/campus/…"`, and `fs/approve/[token]/approval-client.tsx:32` falls back to `""`.

_Fix:_ guard these with a sane fallback, and **verify every `NEXT_PUBLIC_*` var is set in each Appwrite site's _build_ environment** (they're inlined at build; setting them at runtime does nothing). Do one real checkout round-trip.

---

## HIGH — strongly recommended before launch

### 9. Membership check hits 24SO SOAP synchronously on every member pageview
`apps/web/src/lib/actions/membership.ts:100,158-179` + `apps/web/src/app/(public)/layout.tsx:15-16`

`cacheMembershipStatus` writes the cache via `cookieStore.set()`, which **throws in a Server Component render and is swallowed** — and the `(public)` layout (the only browse-path caller) runs in exactly that context. So the 10-minute cache never persists: every page render for an authenticated user with a `student_id` does Appwrite `listRows` → SOAP `HasSession` → SOAP `GetCustomerCategories`, blocking the layout up to the 3s deadline. The `withDeadline` race doesn't abort the underlying SOAP call, so sockets pile up. Under launch traffic this hammers 24SO; when it throttles, every member's page takes ~3s and returns `finago_error` (members silently lose benefits).

_Fix:_ populate the cache from a route handler / server action instead of during RSC render, or use a server-side cache (unstable_cache/KV) keyed to the user.

### 10. Membership cookie is client-controlled, not user-keyed, and there is no logout
`apps/web/src/lib/actions/membership.ts:130-151`

`getCachedMembership` trusts the `biso_membership` cookie verbatim. `httpOnly` doesn't stop a user setting it via devtools/curl: `{"expiresAt":9e15,"status":{"isMember":true}}` makes `getMembershipStatus()` report member everywhere (layout, shop, cart, checkout, `/api/membership`). Actual order discounts are re-verified server-side, so impact is member-only UI/pricing display (price-mismatch complaints) — but combined with **no sign-out anywhere** in `apps/web` (the cookie isn't keyed to the account and isn't cleared on login), user B on a shared machine sees user A's membership for up to 10 minutes.

_Fix:_ sign the payload or key it to the account `$id`, invalidate on login, and add a working sign-out.

### 11. No timeouts on 24SO SOAP and raw Graph fetches; admin login awaits M365 sync
`packages/connectors/src/24sevenoffice/client.ts:44` (+ every `*Async` call), `apps/admin/src/lib/m365-sync.ts:253-269`, OAuth route `apps/admin/src/app/(auth)/auth/oauth/route.ts:36`

node-soap sets no default HTTP timeout, so a hung 24SO endpoint holds serverless invocations open indefinitely (membership checks, `/api/units/sync`, ledger sync). `syncM365Permissions` uses raw `fetch` with no timeout and no 429/Retry-After handling inside a `while(nextLink)` loop, and the admin OAuth login route **awaits** it — a hung Graph response hangs the login redirect; a 429 during a login burst throws and drops the user into the portal with stale roles.

_Fix:_ add `AbortSignal.timeout(...)` to all SOAP and raw Graph fetches; add Retry-After handling to the M365 sync loop; consider not blocking login on the full sync.

### 12. `/api/admin/*` data routes read as an unauthenticated guest
`apps/api/src/app/api/admin/users/route.ts:50` (also `admin/campuses`, `admin/departments`, bulk/turnover reads)

Authorization is derived from the JWT (`getAdminScope(request)`), but the data read calls `createSessionClient()` with **no argument**, falling back to the `a_session_biso` cookie. On the documented server-to-server JWT path there is no cookie, so `db.listRows` runs as guest. The `user` collection grants read only to `team:…operationsunit`, so `GET /api/admin/users` returns empty/failed for a legitimately-authenticated global admin. Fails closed (no leak) but the endpoint is broken and the auth model is internally inconsistent.

_Fix:_ pass the extracted JWT into the data client (as the expense routes do via `createAuthenticatedClient(req)`).

### 13. SharePoint document listing silently truncates and swallows errors
`packages/connectors/src/sharepoint/index.ts:254-292`

`getDriveItems` never follows `@odata.nextLink` (Graph caps `/children` at ~200/page) and its catch returns the partial array. A drive with >200 files, or a transient Graph error, yields a silently truncated document list that the admin treats as complete — documents disappear from the site with no error surfaced.

_Fix:_ follow pagination and propagate errors instead of returning partial results.

### 14. Membership purchase may not close the loop in 24SO
`packages/connectors/src/24sevenoffice/sync.ts` (`syncMembershipTo24SO` has zero call sites)

Membership **verification** (`getCustomerCategories`) and Finago posting are live, but nothing in this repo assigns the 24SO membership category after a purchase — `syncMembershipTo24SO` is exported and unreferenced. Unless an external Appwrite Function does this, a student who buys a membership still reads `isMember: false`.

_Fix:_ confirm the external function exists and is wired to the new payment callback before launch.

---

## MEDIUM

- **Cross-campus audit-log disclosure** — `apps/admin/.../_actions/activity.ts:14-39`: `listActivityLog` gates on campusadmin/globaladmin but applies no campus filter (the `audit_logs` table has no `campus_id`), so any campus admin reads every campus's audit trail. Requires a schema change to fully fix.
- **Stripe order can stay pending forever after payment** — `packages/shared/utils/vipps-order-ops.ts:262-270`: `applyOrderStatusTransition` has no monotonic guard, so a stale return-route write can regress PAID→PENDING. Vipps self-heals via its reconcile cron; **Stripe has no such cron** (`reconcile-orders/route.ts:69-71` skips non-Vipps), so a captured Stripe order can stay pending indefinitely.
- **Reservation hold not extended at checkout** — `apps/web/src/app/actions/cart-reservations.ts:115`: the 10-min hold is stamped at add-to-cart and not renewed when checkout starts, so on a sold-out drop two buyers can pay for the same last unit (guaranteed manual refunds).
- **Stock-decrement crash window** — `vipps-order-ops.ts:215-259`: the `transition_lock` is claimed **before** the decrement, so a crash between them makes every retry skip the decrement forever (availability permanently overstated). And when the atomic claim throws (e.g. 8s Appwrite timeout under load), the code proceeds with a non-atomic decrement, allowing a double-decrement / double Finago post under concurrent webhook+return traffic.
- **`getCompanies` fails open** — `packages/connectors/src/24sevenoffice/company.ts:95-98`: any 24SO error returns `[]`, and `findOrCreateCompany` then **creates** a duplicate CRM customer. Currently only reachable via the unused sync module, but a landmine for whoever wires purchase sync.
- **Expense submit returns HTTP 200 on failures** — `apps/api/src/app/api/expenses/submit/route.ts:202-210,273-282,427-433`: error paths return 200 with `{success:false}`, and the catch serializes a raw Error to `{}`. The web `api-client` only throws on `!response.ok`, so callers must remember to check `body.success`.
- **Anonymous-user cleanup never runs in prod** — `apps/api/vercel.json` schedules `/api/cleanup-anon-users` via a Vercel cron, but prod deploys to Appwrite Sites and the scheduled-dispatch function has no entry for it → anonymous Appwrite users accumulate forever.
- **Silent prod-data default** — `packages/api/server.ts:45-52`, `client.ts`, `storage.ts`: endpoint/project default to `https://appwrite.biso.no/v1` / project `biso`. Any staging/CI without these vars silently reads/writes **production** data.
- **Per-request MSAL/Graph clients** — `apps/web/.../documents/[id]/download/route.ts:29`, `apps/admin/.../documents.ts:36`, `graph.ts` helpers: a new `ConfidentialClientApplication` per request defeats token caching → an AAD token round-trip on every call, risking `/token` 429s under load.
- **File-upload endpoints buffer before size check** — `apps/api/.../expenses/ocr/route.ts` and `.../upload`: `req.formData()` reads the whole multipart body into memory before the 10 MB check; no `Content-Length` pre-check, `maxDuration=300`. Memory-pressure vector.
- **`next/image` throws on unlisted hosts** — news/event/product images with an admin-supplied URL whose host isn't in `remotePatterns` (note `www.biso.no` is **not** covered by `biso.no`) 500 the detail page server-side; `ImageWithFallback`'s `onError` only catches client load errors.
- **Magic-link callback unguarded** — `apps/web/src/app/(auth)/auth/callback/route.ts:28-43`: `users.get()/createTarget()` after session creation can throw (double-clicked link, Appwrite blip) → 500 with the one-time token already consumed; the cookie also has no `maxAge` (session-scoped, silent logout on browser restart).
- **Homepage fetches up to 1000 events per request** — `apps/web/src/app/(public)/page.tsx:36-43`: `listEvents({limit:1000})` with joins, uncached (`force-dynamic`), awaited before render (so the `<Suspense>` skeletons never show). Degrades toward the 8s timeout as data grows.

---

## LOW / cleanup

- `apps/api/Dockerfile` & `apps/web/Dockerfile`: `COPY … bun.lockb` (repo uses `bun.lock`), `CMD ["bun","server.js"]` wrong for the nested `outputFileTracingRoot` path, and `ENV HOSTNAME=localhost` binds loopback. `apps/admin/Dockerfile` is correct — copy it. (Not the primary deploy path, but any Docker/DR attempt fails.)
- Two web CRON routes skip auth entirely when `CRON_SECRET` is unset outside prod (`reconcile-orders`, `cleanup-reservations`); every other cron route fails closed. Align them.
- `package.json engines.node: ">=18"` but Next 16 needs Node ≥20.9.
- `turbo.json#tasks.build.env` is stale both ways (missing several used vars incl. the ORDERS/DB collection vars; lists dead ones like `PINECONE_*`, `WEBDOCK_API_KEY`).
- Auth-check-before-try in several API routes (`expenses/ocr`, `expenses/summary`, `teams/bot`) yields 500 instead of 401/400.
- Unguarded `JSON.parse(order.items_json)` on the receipt page; `jsonToPageDoc` accepts `{}` and later crashes on `doc.blocks.map` (add `Array.isArray` guard).
- Hardcoded `"a_session_biso"` in `user.ts`/`membership.ts` ignores the `APPWRITE_SESSION_COOKIE` override honored elsewhere.
- Event detail page hardcodes `isMember={false}` (`events/[slug]/page.tsx:87`) — members always see non-member pricing.
- `sitemap.ts` sets `revalidate=3600` under `force-dynamic` (dead) → re-runs 6 queries per crawl.
- Debug logging that prints secret-presence/MSN/internal errors in the webhook-register route and payment-settings actions (their own comments say remove before prod).

---

## Verified solid (no action needed)

- **Payment security core**: Vipps webhook (content-SHA256 + HMAC, constant-time, fails closed) and Stripe `constructEvent`; server-side price recomputation; øre conversion consistent; capture amount validated against order total; reconcile is idempotent; the Finago exactly-once claim has correct crash semantics; reservation cleanup only deletes expired holds and is CRON_SECRET-gated.
- **Admin auth/scoping**: every `(portal)/_actions/*` action gates on `requireAuth`/`requireItPermission`; list actions funnel through `applyScopeQueries` which fails closed; single-row mutations re-check access; IT actions validate client-supplied IDs against the tenant. The page-publish gap (#7) is the one exception.
- **API service**: cron endpoints use timing-safe secret compare and fail closed; the payment checkout recomputes prices and derives userId from the session; the expense approval chain (hashed tokens, atomic decision lock, rollback) is well-built; the 8s Appwrite timeout wrapper degrades hangs to 504s; CORS reflects only allowlisted origins.
- **Web**: the JWT api-client 14-min cache is per-browser only (no cross-user server leak — verified it's never imported by server code); error boundaries (`error.tsx`, `global-error.tsx`, `not-found`, `unauthorized`) are all wired; lazy-session reads are defensive; no cross-user cache paths; sitemap/robots are best-effort.
- **Connectors/AI**: ledger posting idempotency (expense + order) is the best-engineered code in scope; SDK-based Graph clients get the RetryHandler (429/503/504); secrets are redacted from Graph errors; `generateObject` calls are zod-validated and degrade to "manual" on failure; WooCommerce route has a 10s timeout.

---

## Minimal pre-launch checklist

1. Fix #1 (CMS render) and confirm with one `next build && next start` load of a real published page.
2. Set `APPWRITE_ORDERS_COLLECTION_ID` / `APPWRITE_DATABASE_ID` / `APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID` on web **and** api sites (or add `??` defaults), and run one real checkout end-to-end.
3. Fix Stripe failed-payment mapping (#3) and add stock/limit checks to the API checkout route (#5).
4. Flip `payment_settings.test_mode` to live (#4) and re-register the Vipps webhook.
5. Confirm all `NEXT_PUBLIC_*` vars are set in each site's **build** env; guard `NEXT_PUBLIC_BASE_URL` on the return route (#8).
6. Add auth/validation to the board endpoint (#6) and `assertPublishAccess` to page publish (#7).
7. Make the membership cache actually persist (#9) and add SOAP/Graph timeouts (#11).
8. Confirm the external 24SO membership-category assignment function exists (#14).
