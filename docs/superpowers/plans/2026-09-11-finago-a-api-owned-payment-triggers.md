# Finago Plan A — API-owned payment return and reconcile sweep

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every payment-provider and Finago call that happens after checkout runs in `apps/api`; the web app only redirects to, or fetches from, the API app.

**Architecture:** The provider return URL moves from the web route `/api/checkout/return` to a new API route `/api/payment/return` that reconciles the payment, calls `settleOrderIfPaid`, and redirects to the web receipt or the app deep link. The reconcile cron moves from `apps/web` to `apps/api`. The web `verifyOrder` action calls the existing API `GET /api/payment/orders/[orderId]`. The old web return route becomes a redirect-only shim.

**Tech Stack:** Next.js 16 route handlers, Vitest, Bun workspaces, Appwrite (`@repo/api`), `@repo/payment`, `@repo/shared`.

**Spec:** `docs/superpowers/specs/2026-09-11-finago-shop-ledger-posting-design.md` (section "Trigger ownership").

**Plan series:** A (this plan) → B (`2026-09-11-finago-b-shop-ledger-posting-core.md`) → C (`2026-09-11-finago-c-accounting-admin-and-rollout.md`). A ships on its own.

## Global Constraints

- Package manager is Bun (`bun@1.3.1`). Never use npm or pnpm.
- `bun run check-types` must pass; run `bun x ultracite fix` before each commit.
- The web app makes no Finago, Vipps or Stripe calls. It calls the API app or Appwrite.
- Never hand-edit `packages/api/appwrite.config.json` or `packages/api/types/appwrite.ts`.
- API cron routes authenticate with `CRON_SECRET` via `x-cron-secret` or `Authorization: Bearer`, and answer 500 when `CRON_SECRET` is unset.
- Tests never call Vipps, Stripe or Finago.
- Every commit message ends with exactly these two lines:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv`

---

### Task 0: Feature branch

**Files:**
- Commit: `docs/superpowers/specs/2026-09-11-finago-shop-ledger-posting-design.md`, `docs/superpowers/plans/2026-09-11-finago-*.md`

- [ ] **Step 1: Create the branch**

Run: `git checkout -b feat/finago-shop-ledger`
Expected: `Switched to a new branch 'feat/finago-shop-ledger'`

- [ ] **Step 2: Commit the spec and plans**

```bash
git add docs/superpowers/specs/2026-09-11-finago-shop-ledger-posting-design.md docs/superpowers/plans/2026-09-11-finago-a-api-owned-payment-triggers.md docs/superpowers/plans/2026-09-11-finago-b-shop-ledger-posting-core.md docs/superpowers/plans/2026-09-11-finago-c-accounting-admin-and-rollout.md
git commit -F - <<'EOF'
Add the Finago shop ledger posting design and plans

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 1: Public URL helpers for the API app

**Files:**
- Create: `apps/api/src/lib/public-urls.ts`
- Test: `apps/api/src/lib/public-urls.test.ts`

**Interfaces:**
- Produces: `webBaseUrl(): string | undefined`, `apiBaseUrl(): string | undefined`, `interface PublicUrls { apiBase: string; webBase: string }` — all without trailing slashes.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/lib/public-urls.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl, webBaseUrl } from "./public-urls";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("webBaseUrl", () => {
  it("prefers the web-specific origin and strips trailing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "https://biso.no/");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://api.biso.no");
    expect(webBaseUrl()).toBe("https://biso.no");
  });

  it("falls back to the shared origin", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");
    expect(webBaseUrl()).toBe("https://biso.no");
  });

  it("is undefined when neither is set", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect(webBaseUrl()).toBeUndefined();
  });
});

describe("apiBaseUrl", () => {
  it("returns the API origin without trailing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no//");
    expect(apiBaseUrl()).toBe("https://api.biso.no");
  });

  it("is undefined when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(apiBaseUrl()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test src/lib/public-urls.test.ts`
Expected: FAIL — `Failed to resolve import "./public-urls"`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/api/src/lib/public-urls.ts
const TRAILING_SLASHES_RE = /\/+$/;

export interface PublicUrls {
  apiBase: string;
  webBase: string;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(TRAILING_SLASHES_RE, "");
  return trimmed ? trimmed : undefined;
}

/**
 * The public website origin buyers are sent to (receipt page, cart, membership
 * join flow). In split-host deployments this app has its own
 * NEXT_PUBLIC_BASE_URL, so the web-specific variable wins.
 */
export function webBaseUrl(): string | undefined {
  return (
    clean(process.env.NEXT_PUBLIC_WEB_BASE_URL) ??
    clean(process.env.NEXT_PUBLIC_BASE_URL)
  );
}

/**
 * This API app's own public origin — where payment providers send buyers back
 * to after paying, so reconciliation and settlement run here.
 */
export function apiBaseUrl(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_API_BASE_URL);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && bun run test src/lib/public-urls.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add apps/api/src/lib/public-urls.ts apps/api/src/lib/public-urls.test.ts
git commit -F - <<'EOF'
Add public URL helpers for the API app

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 2: Point provider return URLs at the API app

**Files:**
- Modify: `packages/shared/utils/checkout-return.ts`
- Test: `packages/shared/utils/checkout-return.test.ts`
- Modify: `apps/api/src/app/api/payment/[provider]/checkout/route.ts`
- Modify: `apps/api/src/app/api/payment/[provider]/membership-checkout/route.ts`
- Test: `apps/api/src/app/api/payment/[provider]/checkout/route.test.ts`
- Test: `apps/api/src/app/api/payment/[provider]/membership-checkout/route.test.ts`

**Interfaces:**
- Consumes: `apiBaseUrl`, `webBaseUrl`, `PublicUrls` from Task 1.
- Produces: `checkoutReturnUrl(apiBaseUrl: string, orderId: string, client?: CheckoutClient, options?: { cancelled?: boolean }): string` returning `${apiBaseUrl}/api/payment/return?orderId=…`.

- [ ] **Step 1: Update the shared URL tests to the new target**

In `packages/shared/utils/checkout-return.test.ts`, replace the whole `describe("checkoutReturnUrl", …)` block with:

```ts
describe("checkoutReturnUrl", () => {
  it("points at the API return route, which owns reconciliation", () => {
    expect(checkoutReturnUrl("https://api.biso.no", "order-1")).toBe(
      "https://api.biso.no/api/payment/return?orderId=order-1"
    );
  });

  it("leaves the web URL unmarked so existing behaviour is untouched", () => {
    expect(
      checkoutReturnUrl("https://api.biso.no", "order-1", "web")
    ).not.toContain("client=");
  });

  it("marks an app checkout so the return route can deep-link back", () => {
    expect(checkoutReturnUrl("https://api.biso.no", "order-1", "app")).toBe(
      "https://api.biso.no/api/payment/return?orderId=order-1&client=app"
    );
  });

  it("normalises a trailing slash on the base URL", () => {
    expect(checkoutReturnUrl("https://api.biso.no/", "order-1")).toBe(
      "https://api.biso.no/api/payment/return?orderId=order-1"
    );
  });

  it("escapes the order id", () => {
    expect(checkoutReturnUrl("https://api.biso.no", "a b&c")).toBe(
      "https://api.biso.no/api/payment/return?orderId=a%20b%26c"
    );
  });
});
```

In the same file's `describe("cancel marking", …)` block, replace each `"https://biso.no"` argument with `"https://api.biso.no"` (three occurrences).

- [ ] **Step 2: Update the API checkout route tests**

In `apps/api/src/app/api/payment/[provider]/checkout/route.test.ts`, directly below line 161 (`vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");`) add:

```ts
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no");
```

Replace the whole `describe("post-payment return target", …)` block with:

```ts
  describe("post-payment return target", () => {
    async function postStripe(request: NextRequest) {
      return await POST(request, {
        params: Promise.resolve({ provider: "stripe" }),
      });
    }

    it("returns web buyers through the API return route", async () => {
      await postVipps(checkoutRequest({ authorization: "Bearer valid" }));

      expect(mockedCreateVippsPayment).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { returnUrl: "https://api.biso.no/api/payment/return?orderId=order-1" }
      );
    });

    it("marks an app checkout so the return route deep-links back", async () => {
      await postVipps(
        checkoutRequest({ authorization: "Bearer valid", client: "app" })
      );

      expect(mockedCreateVippsPayment).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        {
          returnUrl:
            "https://api.biso.no/api/payment/return?orderId=order-1&client=app",
        }
      );
    });

    it("ignores an unknown client rather than trusting it", async () => {
      await postVipps(
        checkoutRequest({
          authorization: "Bearer valid",
          client: "https://evil.example",
        })
      );

      expect(mockedCreateVippsPayment).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { returnUrl: "https://api.biso.no/api/payment/return?orderId=order-1" }
      );
    });

    it("marks a cancelled app checkout apart from a successful one", async () => {
      await postStripe(
        checkoutRequest({ authorization: "Bearer valid", client: "app" })
      );

      expect(mockedCreateStripeCheckoutSession).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        {
          cancelUrl:
            "https://api.biso.no/api/payment/return?orderId=order-1&client=app&cancelled=1",
          successUrl:
            "https://api.biso.no/api/payment/return?orderId=order-1&client=app",
        }
      );
    });

    it("keeps sending a cancelled web checkout back to the web cart", async () => {
      await postStripe(checkoutRequest({ authorization: "Bearer valid" }));

      expect(mockedCreateStripeCheckoutSession).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        {
          cancelUrl: "https://biso.no/shop/cart?cancelled=true",
          successUrl: "https://api.biso.no/api/payment/return?orderId=order-1",
        }
      );
    });

    it("refuses to start a checkout when the API origin is not configured", async () => {
      vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");

      const response = await postVipps(
        checkoutRequest({ authorization: "Bearer valid" })
      );

      expect(response.status).toBe(500);
      expect(mockedCreateVippsPayment).not.toHaveBeenCalled();
    });
  });
```

In `apps/api/src/app/api/payment/[provider]/membership-checkout/route.test.ts`, directly below line 155 (`vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");`) add:

```ts
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no");
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd packages/shared && bun run test utils/checkout-return.test.ts`
Expected: FAIL — expected `…/api/payment/return…`, received `…/api/checkout/return…`

Run: `cd apps/api && bun run test "src/app/api/payment/[provider]/checkout/route.test.ts"`
Expected: FAIL in `post-payment return target`

- [ ] **Step 4: Change the shared URL builder**

In `packages/shared/utils/checkout-return.ts`, replace the file header comment (lines 1–12) with:

```ts
/**
 * Where a buyer is sent back to after paying, per surface.
 *
 * The website and the native app share one post-payment handler
 * (`/api/payment/return` in `apps/api`), because that handler is what
 * reconciles the payment with the provider and settles the revenue. Only the
 * final hop differs: the website renders its receipt page, the app is handed a
 * `biso://` deep link that reopens it on the order.
 *
 * The surface travels as an enum, never as a caller-supplied URL, so a checkout
 * request can never turn the return handler into an open redirect.
 */
```

Replace the whole `checkoutReturnUrl` function and its doc comment with:

```ts
/**
 * The URL a payment provider redirects the buyer to once payment completes,
 * is cancelled, or fails. Always the API return route — it holds the
 * reconciliation and ledger-settlement logic — with the originating surface
 * appended so that route knows where to send the buyer next.
 */
export function checkoutReturnUrl(
  apiBaseUrl: string,
  orderId: string,
  client: CheckoutClient = "web",
  options: { cancelled?: boolean } = {}
): string {
  const base = apiBaseUrl.replace(TRAILING_SLASHES_RE, "");
  const url = `${base}/api/payment/return?orderId=${encodeURIComponent(orderId)}`;
  if (client === "web") {
    return url;
  }
  const marked = `${url}&${CHECKOUT_CLIENT_PARAM}=${encodeURIComponent(client)}`;
  return options.cancelled ? `${marked}&${CHECKOUT_CANCELLED_PARAM}=1` : marked;
}
```

- [ ] **Step 5: Use the helpers in the product checkout route**

In `apps/api/src/app/api/payment/[provider]/checkout/route.ts`:

Add to the imports:

```ts
import { apiBaseUrl, type PublicUrls, webBaseUrl } from "@/lib/public-urls";
```

Delete the local `webBaseUrl()` function (the one whose comment starts "Return/success/cancel URLs must point at the WEB app's").

Replace `startVippsCheckout` and `startStripeCheckout` with:

```ts
// Resolve credentials before creating the order so a misconfigured provider
// doesn't leave an orphan PENDING order.
async function startVippsCheckout(
  params: CheckoutSessionParams,
  db: CheckoutDb,
  urls: PublicUrls,
  client: "app" | "web"
): Promise<SessionOutcome> {
  const creds = await resolveVippsCredentials(db);
  if (!creds) {
    return { ok: false, message: "Vipps is not configured", status: 503 };
  }

  const { orderId, order } = await createOrder(params, db);
  // The ePayment `reference` is the order id; the redirect target is the API
  // return route. The amount is taken from the persisted order total.
  const returnUrl = checkoutReturnUrl(urls.apiBase, orderId, client);
  const payment = await withDeadline(
    createVippsPayment(
      { ...params, total: order.total ?? params.total, orderId },
      creds,
      { returnUrl }
    ),
    vippsCheckoutTimeoutMs(),
    "Vipps checkout timed out"
  );

  return {
    ok: true,
    orderId,
    session: { checkoutUrl: payment.checkoutUrl, sessionId: payment.reference },
  };
}

async function startStripeCheckout(
  params: CheckoutSessionParams,
  db: CheckoutDb,
  urls: PublicUrls,
  client: "app" | "web"
): Promise<SessionOutcome> {
  const creds = await resolveStripeCredentials(db);
  if (!creds) {
    return { ok: false, message: "Stripe is not configured", status: 503 };
  }

  const { orderId } = await createOrder(params, db);
  const successUrl = checkoutReturnUrl(urls.apiBase, orderId, client);
  // App buyers come back through the return route on cancel too — Stripe only
  // accepts http(s) here, so a `biso://` cancel URL is not an option. The
  // marker is what keeps the two apart: a cancelled Stripe session is left
  // open and unpaid, which reconciles to `pending`, so without it the app
  // would be told to keep waiting for a payment the buyer just abandoned.
  const cancelUrl =
    client === "app"
      ? checkoutReturnUrl(urls.apiBase, orderId, client, { cancelled: true })
      : `${urls.webBase}/shop/cart?cancelled=true`;
  // Same deadline discipline as the Vipps branch — a stalled Stripe call must
  // surface as a 504 instead of hanging the checkout request.
  const session = await withDeadline(
    createStripeCheckoutSession({ ...params, orderId }, creds, {
      successUrl,
      cancelUrl,
    }),
    vippsCheckoutTimeoutMs(),
    "Stripe checkout timed out"
  );

  return { ok: true, orderId, session };
}
```

In `POST`, replace:

```ts
    const webBase = webBaseUrl();
    if (!webBase) {
      return json({ message: "Payment service is misconfigured" }, 500);
    }
```

with:

```ts
    const webBase = webBaseUrl();
    const apiBase = apiBaseUrl();
    if (!(webBase && apiBase)) {
      return json({ message: "Payment service is misconfigured" }, 500);
    }
    const urls: PublicUrls = { apiBase, webBase };
```

and replace:

```ts
      provider === "vipps"
        ? await startVippsCheckout(params, db, webBase, client)
        : await startStripeCheckout(params, db, webBase, client);
```

with:

```ts
      provider === "vipps"
        ? await startVippsCheckout(params, db, urls, client)
        : await startStripeCheckout(params, db, urls, client);
```

- [ ] **Step 6: Use the helpers in the membership checkout route**

In `apps/api/src/app/api/payment/[provider]/membership-checkout/route.ts`:

Add to the imports:

```ts
import { checkoutReturnUrl } from "@repo/shared/utils/checkout-return";
import { apiBaseUrl, type PublicUrls, webBaseUrl } from "@/lib/public-urls";
```

Delete the local `webBaseUrl()` function (the one whose comment starts "Return/success/cancel URLs must point at the WEB app's").

In both membership start functions, change the parameter `webBase: string` to `urls: PublicUrls`, then replace the URL lines:

```ts
  const returnUrl = `${webBase}/api/checkout/return?orderId=${orderId}`;
```

becomes

```ts
  const returnUrl = checkoutReturnUrl(urls.apiBase, orderId);
```

and

```ts
  const successUrl = `${webBase}/api/checkout/return?orderId=${orderId}`;
  const cancelUrl = `${webBase}/membership/join?cancelled=true`;
```

becomes

```ts
  const successUrl = checkoutReturnUrl(urls.apiBase, orderId);
  const cancelUrl = `${urls.webBase}/membership/join?cancelled=true`;
```

In `POST`, replace:

```ts
    const webBase = webBaseUrl();
    if (!webBase) {
      return json({ message: "Payment service is misconfigured" }, 500);
    }
```

with:

```ts
    const webBase = webBaseUrl();
    const apiBase = apiBaseUrl();
    if (!(webBase && apiBase)) {
      return json({ message: "Payment service is misconfigured" }, 500);
    }
    const urls: PublicUrls = { apiBase, webBase };
```

and in the call that starts the Vipps or Stripe membership checkout, pass `urls` where it passed `webBase`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd packages/shared && bun run test utils/checkout-return.test.ts`
Expected: PASS

Run: `cd apps/api && bun run test "src/app/api/payment/[provider]"`
Expected: PASS (checkout and membership-checkout suites)

Run: `cd apps/api && bun run check-types`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
bun x ultracite fix
git add packages/shared/utils/checkout-return.ts packages/shared/utils/checkout-return.test.ts "apps/api/src/app/api/payment/[provider]"
git commit -F - <<'EOF'
Send buyers back through the API app after paying

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 3: API payment return route

**Files:**
- Create: `apps/api/src/app/api/payment/return/route.ts`
- Test: `apps/api/src/app/api/payment/return/route.test.ts`

**Interfaces:**
- Consumes: `webBaseUrl` (Task 1); `reconcileOrderPayment(orderId, db)` from `@repo/payment/reconcile`; `settleOrderIfPaid(orderId, db)` from `@repo/shared/utils/order-settlement` (never throws, exactly-once); `isMembershipOrder(order)` from `@repo/shared/utils/membership-fulfilment`; deep-link helpers from `@repo/shared/utils/checkout-return`.
- Produces: `GET /api/payment/return?orderId=…[&client=app[&cancelled=1]]` → 307 redirect.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/app/api/payment/return/route.test.ts
import { createAdminClient } from "@repo/api/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  isMembershipOrder: vi.fn(),
  reconcileOrderPayment: vi.fn(),
  settleOrderIfPaid: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({ createAdminClient: vi.fn() }));
vi.mock("@repo/payment/reconcile", () => ({
  reconcileOrderPayment: mocks.reconcileOrderPayment,
}));
vi.mock("@repo/shared/utils/order-settlement", () => ({
  settleOrderIfPaid: mocks.settleOrderIfPaid,
}));
vi.mock("@repo/shared/utils/membership-fulfilment", () => ({
  isMembershipOrder: mocks.isMembershipOrder,
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const db = { getRow: vi.fn() };

function returnRequest(query: string): Request {
  return new Request(`https://api.biso.no/api/payment/return?${query}`);
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    $id: "order-1",
    order_items: [],
    payment_session_id: "session-1",
    status: "paid",
    ...overrides,
  };
}

describe("payment return", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "https://biso.no");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedCreateAdminClient.mockResolvedValue({ db } as never);
    mocks.reconcileOrderPayment.mockResolvedValue(undefined);
    mocks.settleOrderIfPaid.mockResolvedValue(undefined);
    mocks.isMembershipOrder.mockReturnValue(false);
    db.getRow.mockResolvedValue(order());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reconciles, settles, and sends a paid web buyer to the receipt", async () => {
    const response = await GET(returnRequest("orderId=order-1"));

    expect(mocks.reconcileOrderPayment).toHaveBeenCalledWith("order-1", db);
    expect(mocks.settleOrderIfPaid).toHaveBeenCalledWith("order-1", db);
    expect(response.headers.get("location")).toBe(
      "https://biso.no/shop/order/order-1?success=true"
    );
  });

  it("skips the provider round-trip for an order with no payment session", async () => {
    db.getRow.mockResolvedValue(order({ payment_session_id: null }));

    await GET(returnRequest("orderId=order-1"));

    expect(mocks.reconcileOrderPayment).not.toHaveBeenCalled();
    expect(mocks.settleOrderIfPaid).toHaveBeenCalledWith("order-1", db);
  });

  it("still redirects when the provider check fails", async () => {
    mocks.reconcileOrderPayment.mockRejectedValue(new Error("vipps down"));

    const response = await GET(returnRequest("orderId=order-1"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/shop/order/order-1?success=true"
    );
  });

  it("sends a cancelled membership buyer back to the join flow", async () => {
    db.getRow.mockResolvedValue(order({ status: "cancelled" }));
    mocks.isMembershipOrder.mockReturnValue(true);

    const response = await GET(returnRequest("orderId=order-1"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/membership/join?cancelled=true"
    );
  });

  it("sends a failed shop buyer back to the cart", async () => {
    db.getRow.mockResolvedValue(order({ status: "failed" }));

    const response = await GET(returnRequest("orderId=order-1"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/shop/cart?error=payment_failed"
    );
  });

  it("deep-links an app buyer back into the app with the status", async () => {
    const response = await GET(returnRequest("orderId=order-1&client=app"));

    expect(response.headers.get("location")).toBe(
      "biso://shop/order?orderId=order-1&status=paid"
    );
  });

  it("sends a cancelled app checkout to the app cart", async () => {
    db.getRow.mockResolvedValue(order({ status: "pending" }));

    const response = await GET(
      returnRequest("orderId=order-1&client=app&cancelled=1")
    );

    expect(response.headers.get("location")).toBe(
      "biso://shop/cart?cancelled=1"
    );
  });

  it("sends a request without an order id to the shop", async () => {
    const response = await GET(returnRequest(""));

    expect(response.headers.get("location")).toBe("https://biso.no/shop");
    expect(mocks.settleOrderIfPaid).not.toHaveBeenCalled();
  });

  it("sends an unreadable order to the shop with an error", async () => {
    db.getRow.mockRejectedValue(new Error("appwrite down"));

    const response = await GET(returnRequest("orderId=order-1"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/shop?error=unknown"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test src/app/api/payment/return/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 3: Write the route**

```ts
// apps/api/src/app/api/payment/return/route.ts
import { createAdminClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import { reconcileOrderPayment } from "@repo/payment/reconcile";
import {
  appCartDeepLink,
  appOrderDeepLink,
  appShopDeepLink,
  CHECKOUT_CANCELLED_PARAM,
  CHECKOUT_CLIENT_PARAM,
} from "@repo/shared/utils/checkout-return";
import { isMembershipOrder } from "@repo/shared/utils/membership-fulfilment";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import { settleOrderIfPaid } from "@repo/shared/utils/order-settlement";
import { NextResponse } from "next/server";
import { webBaseUrl } from "@/lib/public-urls";

export const dynamic = "force-dynamic";

// Buyers land here straight after paying. A missing web origin must still
// produce a redirect for a customer who has already been charged.
const FALLBACK_WEB_URL = "https://biso.no";

function siteUrl(path: string): URL {
  return new URL(path, webBaseUrl() ?? FALLBACK_WEB_URL);
}

/**
 * A checkout that started in the native app comes back through this same
 * route but must end up in the app. The status rides along so the app can
 * render the outcome straight away; it verifies independently as well,
 * because a browser is free to drop a custom-scheme redirect.
 */
function redirectToApp(
  status: string | null | undefined,
  orderId: string,
  cancelled: boolean
): NextResponse {
  const settled = status === "paid" || status === "authorized";
  // A cancelled Stripe session reconciles to `pending`, so the marker on the
  // cancel URL is honoured only while the order has not actually settled. A
  // Vipps payment the buyer abandons reconciles to `cancelled` outright.
  if ((cancelled && !settled) || status === "cancelled") {
    return NextResponse.redirect(appCartDeepLink(true));
  }
  return NextResponse.redirect(appOrderDeepLink(orderId, status));
}

/**
 * Paid, authorized and pending orders go to the shared receipt page, which
 * renders memberships too. Cancelled and failed membership purchases go back
 * to the join flow, because a membership buyer never touched the cart.
 */
function redirectForStatus(
  status: string | null | undefined,
  orderId: string,
  isMembership: boolean
): NextResponse {
  switch (status) {
    case "paid":
    case "authorized":
      return NextResponse.redirect(
        siteUrl(`/shop/order/${orderId}?success=true`)
      );
    case "cancelled":
      return NextResponse.redirect(
        siteUrl(
          isMembership
            ? "/membership/join?cancelled=true"
            : "/shop/cart?cancelled=true"
        )
      );
    case "failed":
      return NextResponse.redirect(
        siteUrl(
          isMembership
            ? "/membership/join?error=payment_failed"
            : "/shop/cart?error=payment_failed"
        )
      );
    default:
      return NextResponse.redirect(siteUrl(`/shop/order/${orderId}`));
  }
}

/**
 * Payment return endpoint.
 *
 * Payment providers redirect buyers here after completing (or cancelling)
 * payment. Re-syncs the order with the provider so the result page is current
 * even if the webhook has not landed, then settles revenue through
 * `settleOrderIfPaid` — one of three redundant triggers (webhook, this route,
 * reconcile cron); the claim locks inside it make settlement exactly-once.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const isAppCheckout = searchParams.get(CHECKOUT_CLIENT_PARAM) === "app";
  const isCancelled = searchParams.get(CHECKOUT_CANCELLED_PARAM) === "1";

  const failureRedirect = (webPath: string) => {
    if (!isAppCheckout) {
      return NextResponse.redirect(siteUrl(webPath));
    }
    return NextResponse.redirect(
      orderId ? appOrderDeepLink(orderId, null) : appShopDeepLink()
    );
  };

  try {
    if (!orderId) {
      console.error("[payment/return] No orderId provided");
      return failureRedirect("/shop");
    }

    const { db } = await createAdminClient();
    const order = await db.getRow<Orders>("app", "orders", orderId, [
      ORDER_ITEMS_SELECT,
    ]);
    if (!order) {
      return failureRedirect("/shop?error=order_not_found");
    }

    if (order.payment_session_id) {
      await reconcileOrderPayment(orderId, db).catch((error) => {
        console.error("[payment/return] Provider verification failed:", error);
      });
    }

    const refreshed = await db
      .getRow<Orders>("app", "orders", orderId, [ORDER_ITEMS_SELECT])
      .catch(() => null);
    const current = refreshed ?? order;

    await settleOrderIfPaid(orderId, db);

    return isAppCheckout
      ? redirectToApp(current.status, orderId, isCancelled)
      : redirectForStatus(current.status, orderId, isMembershipOrder(current));
  } catch (error) {
    console.error("[payment/return] Error:", error);
    return failureRedirect("/shop?error=unknown");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && bun run test src/app/api/payment/return/route.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add apps/api/src/app/api/payment/return
git commit -F - <<'EOF'
Reconcile and settle returning buyers in the API app

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 4: Move the reconcile cron into the API app

**Files:**
- Create: `apps/api/src/app/api/cron/reconcile-orders/route.ts`
- Test: `apps/api/src/app/api/cron/reconcile-orders/route.test.ts`
- Modify: `functions/scheduled-dispatch/README.md:18`, `functions/scheduled-dispatch/src/main.ts:34`

**Interfaces:**
- Consumes: `reconcileOrderPayment`, `sweepPendingRefunds` (`@repo/payment/reconcile`); `postFinagoTransactionForOrder`, `releaseStaleFinagoClaim`, `FinagoOrder` (`@repo/shared/utils/finago-order-posting`); `fulfilMembershipOrder`, `isMembershipOrder`, `MembershipOrder`, `releaseStaleMembershipClaim`, `stampNonMembershipOrder` (`@repo/shared/utils/membership-fulfilment`); `safeSecretCompare` (`@repo/shared/utils/secrets`).
- Produces: `GET|POST /api/cron/reconcile-orders` with JSON `{ success, reconciled, finagoPosted, staleClaimsReleased, membershipFulfilled, membershipClaimsReleased, refundsSettled, refundsFailed, refundsUnresolved, errors, timestamp }`. Plan B extends this route.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/app/api/cron/reconcile-orders/route.test.ts
import { createAdminClient } from "@repo/api/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  fulfilMembershipOrder: vi.fn(),
  isMembershipOrder: vi.fn(),
  postFinagoTransactionForOrder: vi.fn(),
  reconcileVippsPayment: vi.fn(),
  releaseStaleFinagoClaim: vi.fn(),
  releaseStaleMembershipClaim: vi.fn(),
  stampNonMembershipOrder: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@repo/payment/vipps", () => ({
  reconcileVippsPayment: mocks.reconcileVippsPayment,
}));
vi.mock("@repo/shared/utils/finago-order-posting", () => ({
  postFinagoTransactionForOrder: mocks.postFinagoTransactionForOrder,
  releaseStaleFinagoClaim: mocks.releaseStaleFinagoClaim,
}));
vi.mock("@repo/shared/utils/membership-fulfilment", () => ({
  fulfilMembershipOrder: mocks.fulfilMembershipOrder,
  isMembershipOrder: mocks.isMembershipOrder,
  releaseStaleMembershipClaim: mocks.releaseStaleMembershipClaim,
  stampNonMembershipOrder: mocks.stampNonMembershipOrder,
}));

const CRON_SECRET = "test-cron-secret";
const mockedCreateAdminClient = vi.mocked(createAdminClient);

const db = {
  decrementRowColumn: vi.fn(),
  getRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

function membershipOrder(overrides: Record<string, unknown> = {}) {
  return {
    $id: "order-1",
    $updatedAt: new Date().toISOString(),
    items_json: JSON.stringify([
      {
        product_id: "71",
        product_type: "membership",
        quantity: 1,
        unit_price: 550,
      },
    ]),
    membership_fulfilment_lock: 0,
    membership_invoice_id: null,
    status: "paid",
    ...overrides,
  };
}

const OLD_CREATED_AT = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function shopOrder(id: string) {
  return {
    $id: id,
    $createdAt: OLD_CREATED_AT,
    $updatedAt: OLD_CREATED_AT,
    status: "paid",
    items_json: JSON.stringify([{ product_id: "x", quantity: 1 }]),
    membership_invoice_id: null,
    membership_fulfilment_lock: 0,
  };
}

// Only the membership sweep's listRows call resolves to test rows; the payment
// reconcile and Finago sweeps run first and must see no rows.
function wireListRows(membershipRows: unknown[]) {
  db.listRows.mockImplementation(
    (_dbId: string, _tableId: string, queries: string[]) => {
      const isMembershipSweep = queries.some((q) =>
        q.includes("membership_invoice_id")
      );
      return Promise.resolve({ rows: isMembershipSweep ? membershipRows : [] });
    }
  );
}

function cronRequest(secret: string | null = CRON_SECRET): Request {
  const headers = new Headers();
  if (secret) {
    headers.set("x-cron-secret", secret);
  }
  return new Request("https://api.biso.no/api/cron/reconcile-orders", {
    headers,
  });
}

function resetMocks() {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  mockedCreateAdminClient.mockResolvedValue({ db } as never);
  mocks.isMembershipOrder.mockImplementation(
    (order: { items_json?: string | null }) =>
      (order.items_json ?? "").includes('"product_type":"membership"')
  );
  mocks.releaseStaleMembershipClaim.mockResolvedValue(false);
  mocks.fulfilMembershipOrder.mockResolvedValue({ fulfilled: false });
  mocks.releaseStaleFinagoClaim.mockResolvedValue(false);
  mocks.postFinagoTransactionForOrder.mockResolvedValue({ posted: false });
  mocks.reconcileVippsPayment.mockResolvedValue(undefined);
  db.updateRow.mockResolvedValue({});
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("reconcile-orders cron: auth", () => {
  beforeEach(resetMocks);

  it("rejects a request without the cron secret", async () => {
    wireListRows([]);
    const response = await GET(cronRequest(null));
    expect(response.status).toBe(401);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("accepts the secret as a bearer token", async () => {
    wireListRows([]);
    const response = await GET(
      new Request("https://api.biso.no/api/cron/reconcile-orders", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    expect(response.status).toBe(200);
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(cronRequest());
    expect(response.status).toBe(500);
  });
});

describe("reconcile-orders cron: membership sweep", () => {
  beforeEach(resetMocks);

  it("fulfils a paid membership order that has no invoice id", async () => {
    const order = membershipOrder();
    wireListRows([order]);
    mocks.fulfilMembershipOrder.mockResolvedValue({
      fulfilled: true,
      invoiceId: 556_677,
    });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(mocks.releaseStaleMembershipClaim).toHaveBeenCalledWith(order, db);
    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledWith("order-1", db);
    expect(body.membershipFulfilled).toBe(1);
    expect(body.membershipClaimsReleased).toBe(0);
  });

  it("releases a stale claim and defers fulfilment to the next sweep", async () => {
    const order = membershipOrder({ membership_fulfilment_lock: 1 });
    wireListRows([order]);
    mocks.releaseStaleMembershipClaim.mockResolvedValue(true);

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    expect(body.membershipClaimsReleased).toBe(1);
    expect(body.membershipFulfilled).toBe(0);
  });

  it("skips a row whose claim is live rather than probing it", async () => {
    wireListRows([membershipOrder({ membership_fulfilment_lock: 1 })]);

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    expect(body.membershipFulfilled).toBe(0);
    expect(body.membershipClaimsReleased).toBe(0);
  });
});

describe("reconcile-orders cron: membership recovery under crowding", () => {
  beforeEach(() => {
    resetMocks();
    mocks.fulfilMembershipOrder.mockResolvedValue({ fulfilled: true });
  });

  it("reaches a membership order present alongside 50 old paid shop orders", async () => {
    const shopOrders = Array.from({ length: 50 }, (_, i) =>
      shopOrder(`shop-${i}`)
    );
    wireListRows([...shopOrders, membershipOrder()]);

    const response = await GET(cronRequest());
    const body = (await response.json()) as { membershipFulfilled: number };

    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledTimes(1);
    expect(body.membershipFulfilled).toBe(1);
  });

  it("stamps every crowding shop order so the next run reaches the membership order", async () => {
    const shopOrders = Array.from({ length: 50 }, (_, i) =>
      shopOrder(`shop-${i}`)
    );
    wireListRows(shopOrders);

    const firstRun = await GET(cronRequest());
    const firstBody = (await firstRun.json()) as {
      membershipFulfilled: number;
    };

    expect(firstBody.membershipFulfilled).toBe(0);
    expect(mocks.stampNonMembershipOrder).toHaveBeenCalledTimes(50);

    mocks.stampNonMembershipOrder.mockClear();
    wireListRows([membershipOrder()]);

    const secondRun = await GET(cronRequest());
    const secondBody = (await secondRun.json()) as {
      membershipFulfilled: number;
    };

    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledWith("order-1", db);
    expect(secondBody.membershipFulfilled).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test src/app/api/cron/reconcile-orders/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 3: Write the route**

```ts
// apps/api/src/app/api/cron/reconcile-orders/route.ts
import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  reconcileOrderPayment,
  sweepPendingRefunds,
} from "@repo/payment/reconcile";
import {
  type FinagoOrder,
  postFinagoTransactionForOrder,
  releaseStaleFinagoClaim,
} from "@repo/shared/utils/finago-order-posting";
import {
  fulfilMembershipOrder,
  isMembershipOrder,
  type MembershipOrder,
  releaseStaleMembershipClaim,
  stampNonMembershipOrder,
} from "@repo/shared/utils/membership-fulfilment";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";

/**
 * Order reconciliation sweep. Driven by the `scheduled-dispatch` Appwrite
 * Function (`ORDERS_RECONCILE_URL`), which sends `x-cron-secret`; can also be
 * hit manually with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Passes per run:
 * 1. Payment reconcile — pending/authorized orders older than the grace window
 *    are re-fetched from their provider and put through the idempotent status
 *    transition. The only recovery path that depends on neither the buyer nor
 *    webhook delivery.
 * 2. Finago recovery — paid/authorized shop orders with no
 *    `finago_transaction_id` get their ledger posting retried (stale posting
 *    claims are released first).
 * 3. Refund resolution — refunds still `pending` past the grace window are
 *    resolved against the provider.
 * 4. Membership recovery — paid/authorized membership orders with no
 *    `membership_invoice_id` get fulfilment retried.
 *
 * Recommended schedule: every 5–15 minutes.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const GRACE_MINUTES = 10;
const SWEEP_LIMIT = 50;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

function readBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function hasValidCronSecret(request: Request, secret: string): boolean {
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
  ];
  return candidates.some((candidate) => safeSecretCompare(candidate, secret));
}

function cutoffIso(): string {
  return new Date(Date.now() - GRACE_MINUTES * 60 * 1000).toISOString();
}

async function sweepUnsettledOrders(db: AdminDb): Promise<{
  reconciled: number;
  errors: number;
}> {
  let reconciled = 0;
  let errors = 0;

  for (const status of ["pending", "authorized"]) {
    const orders = await db.listRows<FinagoOrder>("app", "orders", [
      Query.equal("status", status),
      Query.lessThan("$createdAt", cutoffIso()),
      ORDER_ITEMS_SELECT,
      Query.limit(SWEEP_LIMIT),
    ]);

    for (const order of orders.rows) {
      if (!order.payment_session_id) {
        continue;
      }
      try {
        await reconcileOrderPayment(order.$id, db);
        reconciled += 1;
      } catch (error) {
        errors += 1;
        console.error(
          `[Reconcile Orders] Failed to reconcile order ${order.$id}:`,
          error
        );
      }
    }
  }

  return { reconciled, errors };
}

async function sweepMissingFinagoPostings(db: AdminDb): Promise<{
  posted: number;
  released: number;
  errors: number;
}> {
  let posted = 0;
  let released = 0;
  let errors = 0;

  const orders = await db.listRows<FinagoOrder>("app", "orders", [
    Query.equal("status", ["paid", "authorized"]),
    Query.isNull("finago_transaction_id"),
    Query.lessThan("$createdAt", cutoffIso()),
    ORDER_ITEMS_SELECT,
    Query.limit(SWEEP_LIMIT),
  ]);

  for (const order of orders.rows) {
    try {
      if (await releaseStaleFinagoClaim(order, db)) {
        released += 1;
        // Retry on the next sweep rather than immediately, so a still-running
        // poster isn't raced.
        continue;
      }
      if ((order.finago_posting_lock ?? 0) > 0) {
        // A live claim is held by an active poster. Probing it would refresh
        // $updatedAt every sweep, so a crashed claim could never age out.
        continue;
      }
      const result = await postFinagoTransactionForOrder(order.$id, db);
      if (result.posted) {
        posted += 1;
      } else if (result.reason === "post_failed") {
        errors += 1;
      }
    } catch (error) {
      errors += 1;
      console.error(
        `[Reconcile Orders] Finago recovery failed for order ${order.$id}:`,
        error
      );
    }
  }

  return { posted, released, errors };
}

async function recoverMembershipFulfilment(db: AdminDb): Promise<{
  fulfilled: number;
  released: number;
  errors: number;
}> {
  let fulfilled = 0;
  let released = 0;
  let errors = 0;

  const orders = await db.listRows<MembershipOrder>("app", "orders", [
    Query.equal("status", ["paid", "authorized"]),
    Query.isNull("membership_invoice_id"),
    Query.lessThan("$createdAt", cutoffIso()),
    ORDER_ITEMS_SELECT,
    Query.limit(SWEEP_LIMIT),
  ]);

  for (const order of orders.rows) {
    if (!isMembershipOrder(order)) {
      // An unstamped shop order matches this sweep's `IS NULL` query forever;
      // stamp it out so it cannot crowd genuine membership orders.
      await stampNonMembershipOrder(order.$id, db);
      continue;
    }
    try {
      if (await releaseStaleMembershipClaim(order, db)) {
        released += 1;
        continue;
      }
      if ((order.membership_fulfilment_lock ?? 0) > 0) {
        continue;
      }
      const result = await fulfilMembershipOrder(order.$id, db);
      if (result.fulfilled) {
        fulfilled += 1;
      } else if (result.reason === "finago_failed") {
        errors += 1;
      }
    } catch (error) {
      errors += 1;
      console.error(
        `[Reconcile Orders] Membership recovery failed for order ${order.$id}:`,
        error
      );
    }
  }

  return { fulfilled, released, errors };
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { db } = await createAdminClient();
    const reconcile = await sweepUnsettledOrders(db);
    const finago = await sweepMissingFinagoPostings(db);
    const refunds = await sweepPendingRefunds(db, cutoffIso());
    const membership = await recoverMembershipFulfilment(db);

    return NextResponse.json(
      {
        success: true,
        reconciled: reconcile.reconciled,
        finagoPosted: finago.posted,
        staleClaimsReleased: finago.released,
        membershipFulfilled: membership.fulfilled,
        membershipClaimsReleased: membership.released,
        refundsSettled: refunds.settled,
        refundsFailed: refunds.failed,
        refundsUnresolved: refunds.unresolved,
        errors: reconcile.errors + finago.errors + membership.errors,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error in reconcile-orders cron:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reconcile orders" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && bun run test src/app/api/cron/reconcile-orders/route.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Point the dispatcher docs at the API app**

In `functions/scheduled-dispatch/README.md` replace line 18 with:

```markdown
| `ORDERS_RECONCILE_URL` (optional) | re-verifies stale pending/authorized orders against their provider, retries missed Finago ledger postings and membership fulfilment, and resolves pending refunds | `apps/api` → `POST /api/cron/reconcile-orders` |
```

In `functions/scheduled-dispatch/src/main.ts` replace line 34 with:

```ts
 *   ORDERS_RECONCILE_URL        e.g. https://api.biso.no/api/cron/reconcile-orders
```

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add apps/api/src/app/api/cron/reconcile-orders functions/scheduled-dispatch/README.md functions/scheduled-dispatch/src/main.ts
git commit -F - <<'EOF'
Run the order reconcile sweep in the API app

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 5: Web calls the API app instead of third parties

**Files:**
- Modify: `apps/web/src/app/actions/orders.ts` (`verifyOrder`)
- Test: `apps/web/src/app/actions/orders.test.ts`
- Modify: `apps/web/src/app/api/checkout/return/route.ts` (replace with shim)
- Test: `apps/web/src/app/api/checkout/return/route.test.ts` (replace)
- Delete: `apps/web/src/app/api/cron/reconcile-orders/route.ts`, `apps/web/src/app/api/cron/reconcile-orders/route.test.ts`
- Modify: `apps/web/.env.example:42-50`

**Interfaces:**
- Consumes: API `GET /api/payment/orders/[orderId]` (Bearer JWT; reconciles and settles); API `GET /api/payment/return` (Task 3).
- Produces: `verifyOrder(orderId: string): Promise<Orders | null>` — same signature as today.

- [ ] **Step 1: Make the session db controllable in the web order tests**

In `apps/web/src/app/actions/orders.test.ts`, below the `const appwrite = vi.hoisted(…)` block add:

```ts
const sessionDb = vi.hoisted(() => ({
  getRow: vi.fn(),
}));
```

In the `vi.mock("@repo/api/server", …)` factory, replace `db: { getRow: vi.fn() },` with `db: sessionDb,`.

Replace `import { createCartCheckoutSession } from "./orders";` with:

```ts
import { createCartCheckoutSession, verifyOrder } from "./orders";
```

Append at the end of the file:

```ts
describe("verifyOrder", () => {
  const pendingOrder = {
    $id: "order-1",
    payment_provider: "vipps",
    payment_session_id: "session-1",
    status: "pending",
  };

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no");
    appwrite.createSessionJwt.mockResolvedValue("jwt-1");
    sessionDb.getRow.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks the API app to verify and settle, then re-reads the order", async () => {
    sessionDb.getRow
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce({ ...pendingOrder, status: "paid" });
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "order-1", status: "paid" })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyOrder("order-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.biso.no/api/payment/orders/order-1",
      expect.objectContaining({
        cache: "no-store",
        headers: { Authorization: "Bearer jwt-1" },
      })
    );
    expect(result?.status).toBe("paid");
  });

  it("returns the stored order without calling the API when there is no payment session", async () => {
    sessionDb.getRow.mockResolvedValueOnce({
      ...pendingOrder,
      payment_session_id: null,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyOrder("order-1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result?.status).toBe("pending");
  });

  it("returns the stored order when the API app answers with an error", async () => {
    sessionDb.getRow.mockResolvedValueOnce(pendingOrder);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 500 }))
    );

    const result = await verifyOrder("order-1");

    expect(result?.status).toBe("pending");
    expect(sessionDb.getRow).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test src/app/actions/orders.test.ts`
Expected: FAIL in `verifyOrder` — fetch was not called (the action still imports `@repo/payment/reconcile`)

- [ ] **Step 3: Rewrite `verifyOrder`**

In `apps/web/src/app/actions/orders.ts`, replace the whole `verifyOrder` function with:

```ts
/**
 * The buyer's order, re-synced with the payment provider first.
 *
 * Verification and settlement live in the API app
 * (`GET /api/payment/orders/[orderId]`), which the native app calls too; the
 * website never talks to Vipps, Stripe or Finago itself. Any failure falls
 * back to the stored order, because the buyer has already paid and must still
 * see a receipt.
 */
export async function verifyOrder(orderId: string) {
  const { db } = await createSessionClient();
  const order = await db.getRow<Orders>("app", "orders", orderId, [
    ORDER_ITEMS_SELECT,
  ]);
  if (!(order?.payment_session_id && order.payment_provider)) {
    return order;
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const jwt = await createSessionJwt().catch(() => null);
  if (!(apiBaseUrl && jwt)) {
    return order;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/payment/orders/${encodeURIComponent(orderId)}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${jwt}` },
        signal: AbortSignal.timeout(checkoutFetchTimeoutMs()),
      }
    );
    if (!response.ok) {
      console.error(
        `[verifyOrder] API verification failed with ${response.status}`
      );
      return order;
    }
    return await db.getRow<Orders>("app", "orders", orderId, [
      ORDER_ITEMS_SELECT,
    ]);
  } catch (error) {
    console.error("[verifyOrder] Failed to verify payment status:", error);
    return order;
  }
}
```

Run: `cd apps/web && bun run lint`
If Biome reports `createAdminClient` as unused in `orders.ts`, remove it from the `@repo/api/server` import at the top of the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun run test src/app/actions/orders.test.ts`
Expected: PASS

- [ ] **Step 5: Replace the web return route with a redirect shim**

Replace the full contents of `apps/web/src/app/api/checkout/return/route.test.ts` with:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("legacy checkout return", () => {
  it("forwards the buyer to the API return route with the same query", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no");

    const response = GET(
      new Request(
        "https://biso.no/api/checkout/return?orderId=order-1&client=app"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://api.biso.no/api/payment/return?orderId=order-1&client=app"
    );
  });

  it("falls back to the shop when the API origin is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");

    const response = GET(
      new Request("https://biso.no/api/checkout/return?orderId=order-1")
    );

    expect(response.headers.get("location")).toBe("https://biso.no/shop");
  });
});
```

Run: `cd apps/web && bun run test src/app/api/checkout/return/route.test.ts`
Expected: FAIL — the current route calls `createAdminClient`

Replace the full contents of `apps/web/src/app/api/checkout/return/route.ts` with:

```ts
import { NextResponse } from "next/server";

/**
 * Legacy post-payment return target.
 *
 * Payment sessions created before the return route moved to the API app still
 * send buyers here. This forwards them, query intact, to the API route that
 * now reconciles and settles the order; it calls no third party itself.
 * Delete it one week after the API return route is live.
 */
export function GET(request: Request): NextResponse {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) {
    return NextResponse.redirect(
      new URL("/shop", process.env.NEXT_PUBLIC_BASE_URL || "https://biso.no")
    );
  }
  const target = new URL("/api/payment/return", apiBase);
  target.search = new URL(request.url).search;
  return NextResponse.redirect(target);
}
```

Run: `cd apps/web && bun run test src/app/api/checkout/return/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Delete the web reconcile cron**

```bash
git rm apps/web/src/app/api/cron/reconcile-orders/route.ts apps/web/src/app/api/cron/reconcile-orders/route.test.ts
```

- [ ] **Step 7: Remove the Finago posting env from the web example**

In `apps/web/.env.example`, delete these lines (42–50):

```
# 24SevenOffice Finago REST API — used by the checkout return route and the
# reconcile-orders cron to post webshop revenue to the general ledger.
TFSO_REST_CLIENT_ID=""
TFSO_REST_CLIENT_SECRET=""
TFSO_REST_ORG_ID=""
# Transaction type number for shop entries (24SO number-series).
TFSO_SHOP_TRANSACTION_TYPE_NUMBER=""
# Receivable account debited for Vipps settlements (e.g. 1579).
TFSO_VIPPS_RECEIVABLE_ACCOUNT=""
```

- [ ] **Step 8: Verify the whole change**

Run: `bun run check-types`
Expected: all packages pass

Run: `cd apps/web && bun run test && cd ../api && bun run test && cd ../../packages/shared && bun run test`
Expected: all suites PASS

Run: `grep -rn "@repo/payment/reconcile\|finago-order-posting\|membership-fulfilment" apps/web/src --include='*.ts' --include='*.tsx'`
Expected: no matches

- [ ] **Step 9: Commit**

```bash
bun x ultracite fix
git add apps/web/src/app/actions/orders.ts apps/web/src/app/actions/orders.test.ts apps/web/src/app/api/checkout/return apps/web/.env.example
git commit -F - <<'EOF'
Verify web orders through the API app and retire web payment routes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 6: Rollout (owner)

No code. CI (`.github/workflows/deploy-production.yml`) deploys api, web and admin in parallel on merge, so order the work around the merge, not around deploys.

**Before merging**
- [ ] **Step 1:** On the **api** site in the Appwrite console, set `NEXT_PUBLIC_API_BASE_URL=https://api.biso.no` and `NEXT_PUBLIC_WEB_BASE_URL=https://biso.no` (both are inlined at build time; without them every checkout returns 500). Confirm the api site has `TFSO_APP_ID`, `TFSO_USERNAME`, `TFSO_PASSWORD` (membership invoices) and `TFSO_REST_CLIENT_ID`, `TFSO_REST_CLIENT_SECRET`, `TFSO_REST_ORG_ID` (ledger posting, refund reversal) — these flows now run only there.
- [ ] **Step 2:** In `scheduled-dispatch`, set `ORDERS_RECONCILE_URL_TIMEOUT_MS=300000` (or deploy the function with the new default from this branch).

**Merge and deploy**
- [ ] **Step 3:** Merge. If the Appwrite console lets you activate deployments manually, activate **api** before **web**. Sessions created before the deploy that return while web is live and api is not can briefly see an error page; the provider webhook and the reconcile cron still settle those orders.
- [ ] **Step 4:** Verify: `curl -sI "https://api.biso.no/api/payment/return?orderId=does-not-exist" | grep -i location` → `location: https://biso.no/shop?error=order_not_found`.

**After deploy**
- [ ] **Step 5:** In `scheduled-dispatch`, change `ORDERS_RECONCILE_URL` to `https://api.biso.no/api/cron/reconcile-orders`. Check the next execution log shows a 200 from the API.
- [ ] **Step 6:** Place a small Vipps test order and confirm the browser returns through `api.biso.no/api/payment/return` to `/shop/order/<id>?success=true`.
- [ ] **Step 7:** One week later, in a follow-up PR, delete `apps/web/src/app/api/checkout/return/` and `apps/web/src/app/api/cron/reconcile-orders/`.
- [ ] **Step 5:** One week later, delete `apps/web/src/app/api/checkout/return/` in a follow-up commit.
