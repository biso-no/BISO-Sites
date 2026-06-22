import { createAdminClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { verifyStripeWebhook } from "@repo/payment/stripe";
import { getVippsSession, verifyVippsCallbackToken } from "@repo/payment/vipps";
import {
  determineStatusFromStripeSession,
  type StripeSessionLike,
} from "@repo/shared/utils/stripe-pure";
import {
  applyOrderStatusTransition,
  updateOrderStatus,
} from "@repo/shared/utils/vipps-order-ops";
import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

const STRIPE_SESSION_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);

type StripeWebhookSession = StripeSessionLike & {
  metadata?: Record<string, string> | null;
};

async function handleVippsCallback(req: NextRequest, origin: string | null) {
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  const orderId = new URL(req.url).searchParams.get("orderId");
  const authToken = req.headers.get("authorization") ?? "";

  const { db } = await createAdminClient();
  const creds = await resolveVippsCredentials(db);

  if (!(creds && verifyVippsCallbackToken(authToken, creds))) {
    return json({ message: "Invalid callback authorization" }, 401);
  }
  if (!orderId) {
    return json({ message: "Missing orderId" }, 400);
  }

  const order = await db
    .getRow<Orders>("app", "orders", orderId)
    .catch(() => null);

  if (order?.payment_session_id) {
    const { paymentState, sessionData } = await getVippsSession(
      order.payment_session_id,
      creds
    );
    await updateOrderStatus(orderId, paymentState, sessionData, db);
  }

  return json({ received: true });
}

async function handleStripeCallback(req: NextRequest, origin: string | null) {
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  const { db } = await createAdminClient();
  const creds = await resolveStripeCredentials(db);
  if (!creds) {
    return json({ message: "Stripe is not configured" }, 503);
  }

  let event: ReturnType<typeof verifyStripeWebhook>;
  try {
    event = verifyStripeWebhook(payload, signature, creds);
  } catch (error) {
    console.error("[payment/stripe/callback] signature check failed:", error);
    return json({ message: "Invalid signature" }, 400);
  }

  if (STRIPE_SESSION_EVENTS.has(event.type)) {
    const session = event.data.object as StripeWebhookSession;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      const { status, updateData } = determineStatusFromStripeSession(session);
      await applyOrderStatusTransition(orderId, status, updateData, db);
    }
  }

  return json({ received: true });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const origin = req.headers.get("origin");
  const { provider } = await ctx.params;

  try {
    if (provider === "vipps") {
      return await handleVippsCallback(req, origin);
    }
    if (provider === "stripe") {
      return await handleStripeCallback(req, origin);
    }
    return applyCorsHeaders(
      NextResponse.json(
        { message: "Unknown payment provider" },
        { status: 404 }
      ),
      origin
    );
  } catch (error) {
    console.error(`[payment/${provider}/callback] error:`, error);
    return applyCorsHeaders(
      NextResponse.json(
        { message: "Callback handling failed" },
        { status: 500 }
      ),
      origin
    );
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
