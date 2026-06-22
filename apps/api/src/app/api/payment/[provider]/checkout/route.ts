import { createAdminClient } from "@repo/api/server";
import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { createStripeCheckoutSession } from "@repo/payment/stripe";
import { createVippsCheckoutSession } from "@repo/payment/vipps";
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

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const origin = req.headers.get("origin");
  const { provider } = await ctx.params;

  console.log(`[payment/${provider}/checkout] → POST origin=${origin ?? "(none)"}`);

  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  try {
    if (!isProvider(provider)) {
      console.warn(`[payment/${provider}/checkout] unknown provider`);
      return json({ message: "Unknown payment provider" }, 404);
    }

    // Availability kill switch (Phase A/B). Separate from credential config.
    const flagKey = provider === "vipps" ? "payments_vipps" : "payments_stripe";
    const flagEnabled = await isFeatureEnabled(flagKey);
    console.log(`[payment/${provider}/checkout] feature flag "${flagKey}" = ${flagEnabled}`);
    if (!flagEnabled) {
      return json(
        { message: `${provider} payment is currently unavailable` },
        403
      );
    }

    const webBase = webBaseUrl();
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    console.log(`[payment/${provider}/checkout] env NEXT_PUBLIC_WEB_BASE_URL="${webBase ?? "(missing)"}" NEXT_PUBLIC_API_BASE_URL="${apiBase ?? "(missing)"}"`);
    if (!(webBase && apiBase)) {
      return json({ message: "Payment service is misconfigured" }, 500);
    }

    let rawBody: unknown = null;
    const body = (await req.json().catch((e) => {
      console.error(`[payment/${provider}/checkout] failed to parse JSON body:`, e);
      return null;
    })) as CheckoutBody | null;
    rawBody = body;
    const bodyValid = isValidBody(body);
    console.log(`[payment/${provider}/checkout] body valid=${bodyValid}`, {
      userId: body?.userId ?? "(missing)",
      reference: body?.reference ?? "(missing)",
      email: body?.customerInfo?.email ?? "(missing)",
      itemCount: Array.isArray(body?.items) ? body.items.length : "(missing)",
      total: body?.total ?? "(missing)",
    });
    if (!bodyValid) {
      console.warn(`[payment/${provider}/checkout] rejected — raw body:`, rawBody);
      return json({ message: "Invalid checkout payload" }, 400);
    }

    const { db } = await createAdminClient();
    const params = toCheckoutParams(body);

    // Resolve managed (or env-fallback) credentials before creating the order
    // so a misconfigured provider doesn't leave an orphan PENDING order.
    let session: { checkoutUrl: string; sessionId: string };
    let orderId: string;

    if (provider === "vipps") {
      console.log(`[payment/vipps/checkout] resolving credentials…`);
      const creds = await resolveVippsCredentials(db);
      if (!creds) {
        console.error(`[payment/vipps/checkout] credentials resolved=false — no complete credential set in DB or env`);
        return json({ message: "Vipps is not configured" }, 503);
      }
      console.log(`[payment/vipps/checkout] credentials resolved=true`, {
        testMode: creds.testMode,
        msn: creds.merchantSerialNumber,
        clientIdPrefix: `${creds.clientId.slice(0, 8)}… (len ${creds.clientId.length})`,
        subscriptionKeyPrefix: `${creds.subscriptionKey.slice(0, 8)}… (len ${creds.subscriptionKey.length})`,
        clientSecretLen: creds.clientSecret.length,
        hasCallbackToken: creds.callbackToken.length > 0,
      });
      console.log(`[payment/vipps/checkout] creating order for reference=${params.reference}`);
      ({ orderId } = await createOrder(params, db));
      console.log(`[payment/vipps/checkout] order created orderId=${orderId}`);
      const callbackUrl = `${apiBase}/api/payment/vipps/callback?orderId=${orderId}`;
      const returnUrl = `${webBase}/api/checkout/return?orderId=${orderId}`;
      console.log(`[payment/vipps/checkout] callbackUrl=${callbackUrl} returnUrl=${returnUrl}`);
      session = await createVippsCheckoutSession(
        { ...params, orderId },
        creds,
        { callbackUrl, returnUrl }
      );
      console.log(`[payment/vipps/checkout] session created sessionId=${session.sessionId} checkoutUrl=${session.checkoutUrl}`);
    } else {
      console.log(`[payment/stripe/checkout] resolving credentials…`);
      const creds = await resolveStripeCredentials(db);
      console.log(`[payment/stripe/checkout] credentials resolved=${creds !== null}`);
      if (!creds) {
        return json({ message: "Stripe is not configured" }, 503);
      }
      console.log(`[payment/stripe/checkout] creating order for reference=${params.reference}`);
      ({ orderId } = await createOrder(params, db));
      console.log(`[payment/stripe/checkout] order created orderId=${orderId}`);
      const successUrl = `${webBase}/api/checkout/return?orderId=${orderId}`;
      const cancelUrl = `${webBase}/shop/cart?cancelled=true`;
      console.log(`[payment/stripe/checkout] successUrl=${successUrl} cancelUrl=${cancelUrl}`);
      session = await createStripeCheckoutSession(
        { ...params, orderId },
        creds,
        { successUrl, cancelUrl }
      );
      console.log(`[payment/stripe/checkout] session created sessionId=${session.sessionId} checkoutUrl=${session.checkoutUrl}`);
    }

    console.log(`[payment/${provider}/checkout] persisting session on orderId=${orderId}`);
    await updateOrderWithSession(
      orderId,
      {
        provider,
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
      },
      db
    );

    console.log(`[payment/${provider}/checkout] ✓ done — returning checkoutUrl`);
    return json({ checkoutUrl: session.checkoutUrl, orderId });
  } catch (error) {
    console.error(`[payment/${provider}/checkout] unhandled error:`, error);
    return json({ message: "Failed to create checkout session" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
