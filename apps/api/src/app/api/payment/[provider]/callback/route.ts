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
  console.log(`[payment/vipps/callback] → POST orderId=${orderId ?? "(missing)"} hasAuthToken=${authToken.length > 0}`);

  const { db } = await createAdminClient();
  const creds = await resolveVippsCredentials(db);
  const credsResolved = creds !== null;
  const tokenValid = credsResolved && verifyVippsCallbackToken(authToken, creds);
  console.log(`[payment/vipps/callback] credentials resolved=${credsResolved} authToken valid=${tokenValid}`);

  if (!(credsResolved && tokenValid)) {
    return json({ message: "Invalid callback authorization" }, 401);
  }
  if (!orderId) {
    return json({ message: "Missing orderId" }, 400);
  }

  const order = await db
    .getRow<Orders>("app", "orders", orderId)
    .catch((e) => {
      console.error(`[payment/vipps/callback] failed to fetch order ${orderId}:`, e);
      return null;
    });

  console.log(`[payment/vipps/callback] order found=${order !== null} payment_session_id=${order?.payment_session_id ?? "(none)"}`);

  if (order?.payment_session_id) {
    const { paymentState, sessionData } = await getVippsSession(
      order.payment_session_id,
      creds
    );
    console.log(`[payment/vipps/callback] vipps session paymentState=${paymentState}`);
    await updateOrderStatus(orderId, paymentState, sessionData, db);
    console.log("[payment/vipps/callback] order status updated");
  }

  return json({ received: true });
}

async function handleStripeCallback(req: NextRequest, origin: string | null) {
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  console.log(`[payment/stripe/callback] → POST payloadLength=${payload.length} hasSignature=${signature.length > 0}`);

  const { db } = await createAdminClient();
  const creds = await resolveStripeCredentials(db);
  console.log(`[payment/stripe/callback] credentials resolved=${creds !== null}`);
  if (!creds) {
    return json({ message: "Stripe is not configured" }, 503);
  }

  let event: ReturnType<typeof verifyStripeWebhook>;
  try {
    event = verifyStripeWebhook(payload, signature, creds);
    console.log(`[payment/stripe/callback] event verified type=${event.type}`);
  } catch (error) {
    console.error("[payment/stripe/callback] signature check failed:", error);
    return json({ message: "Invalid signature" }, 400);
  }

  if (STRIPE_SESSION_EVENTS.has(event.type)) {
    const session = event.data.object as StripeWebhookSession;
    const orderId = session.metadata?.orderId;
    console.log(`[payment/stripe/callback] session event orderId=${orderId ?? "(none)"} payment_intent=${typeof session.payment_intent === "string" ? session.payment_intent : "(object/none)"}`);
    if (orderId) {
      const { status, updateData } = determineStatusFromStripeSession(session);
      console.log(`[payment/stripe/callback] applying status transition → ${status}`);
      await applyOrderStatusTransition(orderId, status, updateData, db);
      console.log(`[payment/stripe/callback] order ${orderId} updated to ${status}`);
    }
  } else {
    console.log(`[payment/stripe/callback] ignoring event type=${event.type}`);
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
