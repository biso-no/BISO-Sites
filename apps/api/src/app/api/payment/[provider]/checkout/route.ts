import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { createStripeCheckoutSession } from "@repo/payment/stripe";
import { createVippsPayment } from "@repo/payment/vipps";
import type { CheckoutSessionParams } from "@repo/shared/types/vipps";
import {
  checkoutReturnUrl,
  isCheckoutClient,
} from "@repo/shared/utils/checkout-return";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { getOrderItems } from "@repo/shared/utils/order-parsing";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import {
  createOrder,
  updateOrderWithSession,
} from "@repo/shared/utils/vipps-order-ops";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import {
  buildTrustedCheckoutParams,
  type CheckoutDb,
  type CheckoutLineItemInput,
  CheckoutValidationError,
} from "@/lib/checkout-pricing";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

type Provider = "vipps" | "stripe";
const DEFAULT_VIPPS_CHECKOUT_TIMEOUT_MS = 10_000;
// A buyer who double-submits (or retries after a flaky network) must not end up
// with two orders and two payment sessions for the same cart. Mirrors the
// membership checkout route, which already does this.
const IDEMPOTENCY_WINDOW_MS = 15 * 60 * 1000;
const RECENT_ORDERS_LIMIT = 10;

interface CheckoutBody {
  /**
   * Which surface started this checkout. Native app checkouts get bounced back
   * into the app after payment instead of onto the website; anything else (or
   * nothing) keeps the web behaviour. An enum, never a caller-supplied URL, so
   * this cannot become an open redirect.
   */
  client?: string;
  currency: "NOK";
  customerInfo: {
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
  };
  items: CheckoutLineItemInput[];
  reference: string;
  subtotal: number;
  total: number;
}

function isProvider(value: string): value is Provider {
  return value === "vipps" || value === "stripe";
}

function webBaseUrl(): string | undefined {
  // Return/success/cancel URLs must point at the WEB app's /api/checkout/return
  // route. In split-host deployments the api app has its own NEXT_PUBLIC_BASE_URL,
  // so prefer the web-specific var and only fall back to the shared one.
  return (
    process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL
  );
}

function isValidBody(body: CheckoutBody | null): body is CheckoutBody {
  return Boolean(
    body &&
      body.currency === "NOK" &&
      Array.isArray(body.items) &&
      body.items.length > 0 &&
      typeof body.total === "number" &&
      Number.isFinite(body.total) &&
      body.reference &&
      body.customerInfo?.email
  );
}

type SessionOutcome =
  | {
      ok: true;
      orderId: string;
      session: { checkoutUrl: string; sessionId: string };
    }
  | { ok: false; message: string; status: number };

class CheckoutTimeoutError extends Error {}

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function vippsCheckoutTimeoutMs(): number {
  return readPositiveInteger(
    process.env.VIPPS_CHECKOUT_TIMEOUT_MS,
    DEFAULT_VIPPS_CHECKOUT_TIMEOUT_MS
  );
}

async function withDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new CheckoutTimeoutError(message));
    }, timeoutMs);
    timeout.unref?.();
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function hasBearerToken(req: NextRequest): boolean {
  return req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

async function authenticateCheckout(req: NextRequest) {
  if (!hasBearerToken(req)) {
    return null;
  }
  try {
    const client = await createAuthenticatedClient(req);
    const user = await client.account.get();
    return user?.$id ? { client, userId: user.$id } : null;
  } catch {
    return null;
  }
}

/**
 * A signature of what is being bought, used to tell "the same cart submitted
 * twice" apart from "a second, genuinely different order". Quantities are
 * summed per product and the pairs sorted, so line ordering and how the cart
 * splits a product across variation lines do not change the signature.
 */
function cartSignature(items: CheckoutSessionParams["items"]): string {
  // Keyed on everything that changes what gets FULFILLED, not just what gets
  // charged. A buyer who goes back and swaps a size, or edits a checkout
  // answer, keeps the same product, quantity and total — so a product+quantity
  // signature would call that the same cart and hand them the old order's
  // payment link, fulfilling the selections they just replaced.
  const byLine = new Map<string, number>();
  for (const item of items) {
    const answers = Object.entries(item.customFields ?? {})
      .filter(([, value]) => value?.trim())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value.trim()}`)
      .join(",");
    const key = [item.productId, item.variationId ?? "", answers].join("#");
    byLine.set(key, (byLine.get(key) ?? 0) + item.quantity);
  }
  return [...byLine.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, quantity]) => `${key}:${quantity}`)
    .join("|");
}

/**
 * Returns a still-payable order the same buyer created for the same cart and
 * provider moments ago, so a double-submit reuses its checkout link instead of
 * creating a second order (and a second payment session) for one purchase.
 *
 * Only PENDING orders qualify: once an order is authorized or paid, a repeat
 * submission is a genuine second purchase.
 */
async function findIdempotentOrder(
  db: CheckoutDb,
  userId: string,
  provider: Provider,
  params: CheckoutSessionParams
): Promise<{ checkoutUrl: string; orderId: string } | null> {
  if (!userId || userId === "guest") {
    return null;
  }

  const windowStart = new Date(
    Date.now() - IDEMPOTENCY_WINDOW_MS
  ).toISOString();
  const recent = await db.listRows<Orders>("app", "orders", [
    Query.equal("userId", userId),
    Query.equal("status", "pending"),
    Query.equal("payment_provider", provider),
    Query.greaterThan("$createdAt", windowStart),
    Query.orderDesc("$createdAt"),
    ORDER_ITEMS_SELECT,
    Query.limit(RECENT_ORDERS_LIMIT),
  ]);

  const signature = cartSignature(params.items);
  const totalMinor = Math.round(params.total * 100);

  for (const order of recent.rows) {
    // Re-check in code rather than trusting the query alone: reusing the wrong
    // order would hand the buyer a checkout link for a different amount.
    if (!order.payment_link || order.payment_provider !== provider) {
      continue;
    }
    if (Math.round((order.total ?? 0) * 100) !== totalMinor) {
      continue;
    }
    const orderSignature = cartSignature(
      getOrderItems(order).map((item) => ({
        customFields: Object.fromEntries(
          (item.custom_fields ?? []).map((field) => [field.id, field.value])
        ),
        name: item.name ?? "",
        price: Number(item.unit_price ?? item.price ?? 0),
        productId: item.product_id ?? "",
        quantity: typeof item.quantity === "number" ? item.quantity : 0,
        variationId:
          typeof item.variation_id === "string" ? item.variation_id : undefined,
      }))
    );
    if (orderSignature === signature) {
      return { checkoutUrl: order.payment_link, orderId: order.$id };
    }
  }

  return null;
}

function totalsMatch(clientTotal: number, serverTotal: number): boolean {
  return Math.round(clientTotal * 100) === Math.round(serverTotal * 100);
}

// Resolve credentials before creating the order so a misconfigured provider
// doesn't leave an orphan PENDING order.
async function startVippsCheckout(
  params: CheckoutSessionParams,
  db: CheckoutDb,
  webBase: string,
  client: "app" | "web"
): Promise<SessionOutcome> {
  const creds = await resolveVippsCredentials(db);
  if (!creds) {
    return { ok: false, message: "Vipps is not configured", status: 503 };
  }

  const { orderId, order } = await createOrder(params, db);
  // The ePayment `reference` is the order id; the redirect target is the web
  // return route. The amount is taken from the persisted order total.
  const returnUrl = checkoutReturnUrl(webBase, orderId, client);
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
  webBase: string,
  client: "app" | "web"
): Promise<SessionOutcome> {
  const creds = await resolveStripeCredentials(db);
  if (!creds) {
    return { ok: false, message: "Stripe is not configured", status: 503 };
  }

  const { orderId } = await createOrder(params, db);
  const successUrl = checkoutReturnUrl(webBase, orderId, client);
  // App buyers go back through the return route on cancel too, so the app is
  // handed the same deep link it gets for every other outcome. (Stripe only
  // accepts http(s) here, so a `biso://` cancel URL is not an option anyway.)
  const cancelUrl =
    client === "app"
      ? checkoutReturnUrl(webBase, orderId, client)
      : `${webBase}/shop/cart?cancelled=true`;
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

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const origin = req.headers.get("origin");
  const { provider } = await ctx.params;

  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  try {
    if (!isProvider(provider)) {
      return json({ message: "Unknown payment provider" }, 404);
    }

    const auth = await authenticateCheckout(req);
    if (!auth) {
      return json({ message: "Authentication required" }, 401);
    }

    // Availability kill switch (Phase A/B). Separate from credential config.
    const flagKey = provider === "vipps" ? "payments_vipps" : "payments_stripe";
    if (!(await isFeatureEnabled(flagKey))) {
      return json(
        { message: `${provider} payment is currently unavailable` },
        403
      );
    }

    const webBase = webBaseUrl();
    if (!webBase) {
      return json({ message: "Payment service is misconfigured" }, 500);
    }

    const body = (await req.json().catch(() => null)) as CheckoutBody | null;
    if (!isValidBody(body)) {
      return json({ message: "Invalid checkout payload" }, 400);
    }
    const client = isCheckoutClient(body.client) ? body.client : "web";

    const { db } = await createAdminClient();
    const params = await buildTrustedCheckoutParams({
      authClient: auth.client,
      customerInfo: body.customerInfo,
      db,
      items: body.items,
      reference: body.reference,
      userId: auth.userId,
    });
    if (!totalsMatch(body.total, params.total)) {
      return json({ message: "Checkout total mismatch" }, 400);
    }

    // Reuse a payment session the same buyer started for this exact cart
    // moments ago, so a double-submit does not create a second order. Best
    // effort — a lookup failure must not block a legitimate checkout.
    const existing = await findIdempotentOrder(
      db,
      auth.userId,
      provider,
      params
    ).catch(() => null);
    if (existing) {
      return json({
        checkoutUrl: existing.checkoutUrl,
        orderId: existing.orderId,
      });
    }

    const outcome =
      provider === "vipps"
        ? await startVippsCheckout(params, db, webBase, client)
        : await startStripeCheckout(params, db, webBase, client);

    if (!outcome.ok) {
      return json({ message: outcome.message }, outcome.status);
    }

    const { orderId, session } = outcome;
    await updateOrderWithSession(
      orderId,
      {
        provider,
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
      },
      db
    );

    return json({ checkoutUrl: session.checkoutUrl, orderId });
  } catch (error) {
    if (error instanceof CheckoutTimeoutError) {
      return json({ message: error.message }, 504);
    }

    if (error instanceof CheckoutValidationError) {
      return json({ message: error.message }, error.status);
    }

    console.error(`[payment/${provider}/checkout] error:`, error);
    return json({ message: "Failed to create checkout session" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
