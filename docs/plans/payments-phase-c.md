# Phase C — Stripe backend + managed payment provider configuration

> Status: **deferred / for a fresh conversation.** Phases A and B (the feature-flag
> kill-switch system) are implemented and on branch
> `codex/managed-production-readiness`. This document is the complete spec for
> Phase C so it can be executed independently.

## Why

Two related gaps remain after the feature-flag work:

1. **The webshop payment backend does not exist in this repo.** The web checkout
   action `createProviderCheckoutSession` (`apps/web/src/app/actions/orders.ts`)
   POSTs to `${NEXT_PUBLIC_API_BASE_URL}/api/payment/{provider}/checkout`, but no
   such route exists in `apps/web` or `apps/api`, and `@repo/payment/vipps`'s
   `createVippsCheckoutSession` is never called. So Vipps session creation is
   effectively external/missing, and **Stripe has no backend at all** (the UI is
   a stub; selecting Stripe today would 404). The owner confirmed: **build these
   routes in `apps/api`.**
2. **Payment credentials and test/live mode are env-only.** The owner wants them
   **managed in the admin UI**: store secrets in the DB (Appwrite `encrypt: true`
   columns) and toggle **test mode** per provider from the UI. Vipps uses
   different credentials for test vs live; Stripe uses separate test/live keys.

The feature-flag work already added `payments_vipps` and `payments_stripe`
**availability** kill switches (`packages/shared/utils/feature-flags.ts`) that
hide/refuse a provider at checkout. Phase C adds the **credentials + test-mode**
layer and the actual provider backends.

## Relationship to the existing flags

- `payments_vipps` / `payments_stripe` (already built) = **is this provider
  offered right now?** (kill switch; checkout filters + server rejects).
- Phase C managed config = **which credentials + test/live mode** the backend
  uses when a provider IS enabled.

Keep these separate. A provider is usable only when its flag is on **and** its
config is complete.

## Part 1 — Provider backends in `apps/api`

Mirror the existing `packages/payment/src/vipps/*` structure and reuse the order
lifecycle helpers in `@repo/shared/utils/vipps-order-ops` (`createOrder`,
`updateOrderWithSession`, `updateOrderStatus`, `parseOrderItems`) — order
creation already lives there.

- **`packages/payment/src/stripe/{client.ts,types.ts,index.ts}`** mirroring vipps:
  - `createStripeCheckoutSession(params) → { checkoutUrl, sessionId }` (Stripe
    Checkout Session).
  - `getStripeSession(sessionId) → { paymentState, sessionData }` for return
    verification.
  - `verifyStripeWebhook(payload, signature) → event` (signature check).
  - Add `"./stripe"` to `packages/payment/package.json` exports + the `stripe`
    dependency (root catalog already pins `stripe ^22`).
- **`apps/api/src/app/api/payment/[provider]/checkout/route.ts`** (new — the
  missing backend, for BOTH providers): dynamic `[provider]`; validate
  `payments_{provider}` flag (return 403 if off); load credentials from managed
  config (Part 2); create the order (`createOrder`), create the provider session,
  persist session info (`updateOrderWithSession`), and return
  `{ checkoutUrl, orderId }` — the **exact** shape `createProviderCheckoutSession`
  (`orders.ts:~465`) expects. Match the request payload that action sends.
- **`apps/api/src/app/api/payment/[provider]/callback/route.ts`** (new): provider
  webhooks → `updateOrderStatus`. Vipps verifies via `verifyVippsCallbackToken`;
  Stripe via `verifyStripeWebhook`.
- **`apps/web/src/app/api/checkout/return/route.ts`** (edit): it currently checks
  `payment_provider === "vipps"`. Add a `stripe` branch (verify via
  `getStripeSession`) alongside the existing Vipps branch; keep the Finago post.
- Also reconcile the legacy `apps/web/src/lib/vipps.ts` and the unused
  `@repo/payment/vipps` session creator — pick one path (the `apps/api` route)
  and remove/redirect the other to avoid three Vipps implementations.

## Part 2 — Managed provider configuration (secrets + test mode)

### Schema (apply via appwrite.config.json push or Appwrite MCP)

New table **`payment_settings`** (database `app`, `rowSecurity: false`,
permissions: Operations Unit CRUD only — never `read("any")`; secrets must not be
publicly readable). One row per provider (`$id` = `vipps` | `stripe`) keeps it
simple. Columns:

- `provider` — string enum `["vipps","stripe"]` (or rely on `$id`).
- `test_mode` — boolean (default `true` — safe).
- Secret columns with **`encrypt: true`** (decrypted only for authorized readers;
  store test + live sets so toggling `test_mode` selects the active set):
  - Vipps: `vipps_test_client_id`, `vipps_test_client_secret`,
    `vipps_test_subscription_key`, `vipps_test_msn`, and the `vipps_live_*`
    equivalents.
  - Stripe: `stripe_test_secret_key`, `stripe_test_webhook_secret`,
    `stripe_live_secret_key`, `stripe_live_webhook_secret`.

Note Appwrite `encrypt: true` encrypts at rest and returns plaintext to
authorized readers — so the **API key must never expose these to the browser**;
the admin UI is write-only (see below). Encrypted columns cannot be indexed or
queried by value (fine here).

### Backend credential resolution

Add a resolver in `@repo/payment` (or a small `@repo/api` helper) that, for a
provider, reads the `payment_settings` row with the **admin client**, picks the
test or live secret set based on `test_mode`, and returns the active credentials.
**Fallback to the existing `VIPPS_*` / new `STRIPE_*` env vars** when no DB row
exists, so nothing breaks during migration. The provider `client.ts` files take
credentials as parameters instead of reading `process.env` directly. Cache with a
short TTL like the feature-flag reader.

### Admin UI (global-admin only, write-only secrets)

A new managed surface (extend `/operations`, or a dedicated `/settings/payments`
page reachable from the Settings "Platform" section). Follow the
`integration-health` / `team-health` registry pattern and the studio design:

- Per provider: a **test-mode toggle** (boolean; audited `payment_setting.toggle`)
  and **masked credential inputs**. Show only "configured / not configured" status
  per secret (like `integration-health` shows env presence) — **never render the
  stored secret value**. Submitting a non-empty field updates that encrypted
  column; an empty field leaves it unchanged.
- Server actions are global-admin gated, validated, and audited
  (`payment_setting.update`), `revalidatePath`. Use the session client (Operations
  Unit holds the table grant).
- Surface the active mode + completeness so an admin can see "Vipps: live, fully
  configured" / "Stripe: test, missing webhook secret".

### Env vars

Add `STRIPE_*` (and keep `VIPPS_*`) to `turbo.json` build env allow-list and the
ops env docs as the **fallback** path; the managed DB config is the primary
source once set.

## Verification

- `bun run check-types`, `bun x ultracite check`, `bun run build:web`,
  `build:api`, `build:admin`, `bun --filter @repo/payment test` (add tests for the
  Stripe pure helpers + credential resolver).
- **Staging E2E (cannot be faked locally; document exact steps for the owner):**
  with a Stripe test account + keys + a configured webhook endpoint, and Vipps test
  credentials: complete a Vipps order and a Stripe order; verify the
  return/callback updates order status and posts to Finago; verify toggling
  `test_mode` switches credential sets; verify toggling `payments_*` flags
  hides/blocks each provider; confirm the admin UI never returns secret values.

## Risks

- Largest piece: reconstructs the entire payment backend (absent from the repo)
  plus a new Stripe integration and a secrets store. Mis-reproducing the
  order-creation contract is the main correctness risk — reuse `vipps-order-ops`
  and keep the `{ checkoutUrl, orderId }` response shape exact.
- Secrets handling: never expose encrypted column values to the browser; gate all
  reads behind global-admin + admin client; audit every change.
- `payments_stripe` stays OFF (its catalog default) until this is verified in
  staging.
