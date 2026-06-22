import { createAdminClient } from "@repo/api/server";
import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { createStripeCheckoutSession } from "@repo/payment/stripe";
import { createVippsPayment } from "@repo/payment/vipps";
import { type CheckoutSessionParams, Currency } from "@repo/shared/types/vipps";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import {
  createOrder,
  updateOrderWithSession,
} from "@repo/shared/utils/vipps-order-ops";
import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

type Provider = "vipps" | "stripe";

interface CheckoutBody {
  campusId?: string;
  currency: "NOK";
  customerInfo: {
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
  };
  discountTotal?: number;
  items: CheckoutSessionParams["items"];
  memberDiscountPercent?: number;
  membershipApplied?: boolean;
  reference: string;
  subtotal: number;
  total: number;
  userId: string;
}

function isProvider(value: string): value is Provider {
  return value === "vipps" || value === "stripe";
}

function webBaseUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_WEB_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL
  );
}

function toCheckoutParams(body: CheckoutBody): CheckoutSessionParams {
  return {
    userId: body.userId,
    items: body.items,
    subtotal: body.subtotal,
    discountTotal: body.discountTotal,
    total: body.total,
    reference: body.reference,
    currency: Currency.NOK,
    membershipApplied: body.membershipApplied,
    memberDiscountPercent: body.memberDiscountPercent,
    campusId: body.campusId,
    customerInfo: body.customerInfo,
  };
}

function isValidBody(body: CheckoutBody | null): body is CheckoutBody {
  return Boolean(
    body?.userId &&
      Array.isArray(body.items) &&
      body.items.length > 0 &&
      typeof body.total === "number" &&
      body.reference &&
      body.customerInfo?.email
  );
}

type CheckoutDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

type SessionOutcome =
  | {
      ok: true;
      orderId: string;
      session: { checkoutUrl: string; sessionId: string };
    }
  | { ok: false; message: string; status: number };

// Resolve credentials before creating the order so a misconfigured provider
// doesn't leave an orphan PENDING order.
async function startVippsCheckout(
  params: CheckoutSessionParams,
  db: CheckoutDb,
  webBase: string
): Promise<SessionOutcome> {
  const creds = await resolveVippsCredentials(db);
  if (!creds) {
    return { ok: false, message: "Vipps is not configured", status: 503 };
  }

  const { orderId, order } = await createOrder(params, db);
  // The ePayment `reference` is the order id; the redirect target is the web
  // return route. The amount is taken from the persisted order total.
  const returnUrl = `${webBase}/api/checkout/return?orderId=${orderId}`;
  const payment = await createVippsPayment(
    { ...params, total: order.total ?? params.total, orderId },
    creds,
    { returnUrl }
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
  webBase: string
): Promise<SessionOutcome> {
  const creds = await resolveStripeCredentials(db);
  if (!creds) {
    return { ok: false, message: "Stripe is not configured", status: 503 };
  }

  const { orderId } = await createOrder(params, db);
  const successUrl = `${webBase}/api/checkout/return?orderId=${orderId}`;
  const cancelUrl = `${webBase}/shop/cart?cancelled=true`;
  const session = await createStripeCheckoutSession(
    { ...params, orderId },
    creds,
    { successUrl, cancelUrl }
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

    const { db } = await createAdminClient();
    const params = toCheckoutParams(body);

    const outcome =
      provider === "vipps"
        ? await startVippsCheckout(params, db, webBase)
        : await startStripeCheckout(params, db, webBase);

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
    console.error(`[payment/${provider}/checkout] error:`, error);
    return json({ message: "Failed to create checkout session" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
