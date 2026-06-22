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
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!(webBase && apiBase)) {
      return json({ message: "Payment service is misconfigured" }, 500);
    }

    const body = (await req.json().catch(() => null)) as CheckoutBody | null;
    if (!isValidBody(body)) {
      return json({ message: "Invalid checkout payload" }, 400);
    }

    const { db } = await createAdminClient();
    const params = toCheckoutParams(body);

    // Resolve managed (or env-fallback) credentials before creating the order
    // so a misconfigured provider doesn't leave an orphan PENDING order.
    let session: { checkoutUrl: string; sessionId: string };
    let orderId: string;

    if (provider === "vipps") {
      const creds = await resolveVippsCredentials(db);
      if (!creds) {
        return json({ message: "Vipps is not configured" }, 503);
      }
      ({ orderId } = await createOrder(params, db));
      session = await createVippsCheckoutSession(
        { ...params, orderId },
        creds,
        {
          callbackUrl: `${apiBase}/api/payment/vipps/callback?orderId=${orderId}`,
          returnUrl: `${webBase}/api/checkout/return?orderId=${orderId}`,
        }
      );
    } else {
      const creds = await resolveStripeCredentials(db);
      if (!creds) {
        return json({ message: "Stripe is not configured" }, 503);
      }
      ({ orderId } = await createOrder(params, db));
      session = await createStripeCheckoutSession(
        { ...params, orderId },
        creds,
        {
          successUrl: `${webBase}/api/checkout/return?orderId=${orderId}`,
          cancelUrl: `${webBase}/shop/cart?cancelled=true`,
        }
      );
    }

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
