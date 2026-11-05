import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import type { CheckoutSessionParams } from "@repo/shared/types/vipps";
import { isCheckoutClient } from "@repo/shared/utils/checkout-return";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { getOrderItems } from "@repo/shared/utils/order-parsing";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import { updateOrderWithSession } from "@repo/shared/utils/vipps-order-ops";
import { type NextRequest, NextResponse } from "next/server";
import {
  buildTrustedCheckoutParams,
  type CheckoutDb,
  type CheckoutLineItemInput,
  CheckoutValidationError,
} from "@/lib/checkout-pricing";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import {
  authenticateBuyer,
  CheckoutTimeoutError,
  startStripeCheckout,
  startVippsCheckout,
} from "@/lib/checkout-session";
import { apiBaseUrl, type PublicUrls, webBaseUrl } from "@/lib/public-urls";

type Provider = "vipps" | "stripe";
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

    const auth = await authenticateBuyer(req);
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
    const apiBase = apiBaseUrl();
    if (!(webBase && apiBase)) {
      return json({ message: "Payment service is misconfigured" }, 500);
    }
    const urls: PublicUrls = { apiBase, webBase };

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
        ? await startVippsCheckout(params, db, urls, client)
        : await startStripeCheckout(
            params,
            db,
            urls,
            client,
            "/shop/cart?cancelled=true"
          );

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
