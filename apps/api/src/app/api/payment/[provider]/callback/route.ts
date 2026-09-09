import { createAdminClient } from "@repo/api/server";
import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { getStripeReceiptUrl, verifyStripeWebhook } from "@repo/payment/stripe";
import {
  parseVippsWebhookEvent,
  reconcileVippsPayment,
  verifyVippsWebhookSignature,
} from "@repo/payment/vipps";
import { settleOrderIfPaid } from "@repo/shared/utils/order-settlement";
import {
  determineStatusFromStripeSession,
  type StripeSessionLike,
} from "@repo/shared/utils/stripe-pure";
import { applyOrderStatusTransition } from "@repo/shared/utils/vipps-order-ops";
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

  // The raw body is needed verbatim for the content hash + HMAC signature.
  const rawBody = await req.text();
  const url = new URL(req.url);

  const { db } = await createAdminClient();
  const creds = await resolveVippsCredentials(db);
  if (!creds) {
    return json({ message: "Vipps is not configured" }, 503);
  }

  const verified = verifyVippsWebhookSignature({
    headers: {
      authorization: req.headers.get("authorization"),
      host: req.headers.get("host"),
      "x-ms-content-sha256": req.headers.get("x-ms-content-sha256"),
      "x-ms-date": req.headers.get("x-ms-date"),
    },
    method: "POST",
    pathAndQuery: `${url.pathname}${url.search}`,
    rawBody,
    secret: creds.webhookSecret,
  });
  if (!verified) {
    return json({ message: "Invalid webhook signature" }, 401);
  }

  const event = parseVippsWebhookEvent(rawBody);
  if (!event) {
    return json({ message: "Invalid webhook payload" }, 400);
  }

  // The reference is the internal order id; reconcile fetches the authoritative
  // payment, captures if needed, and applies the transition idempotently.
  await reconcileVippsPayment(event.reference, db);

  // Settle revenue from the webhook too, so mobile buyers who never hit the
  // browser return route still get a ledger entry or membership invoice.
  // `settleOrderIfPaid` is idempotent, so this is safe alongside the return
  // route, the app's verify call and the reconciliation cron.
  await settleOrderIfPaid(event.reference, db);

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
      const { status, updateData } = determineStatusFromStripeSession(
        session,
        event.type
      );
      // Store the hosted receipt alongside the status. `payment_receipt_url` is
      // what the admin order view and the buyer's confirmation page link to;
      // nothing else ever writes it, so without this the link is always dead.
      if (typeof updateData.payment_intent_id === "string") {
        const receiptUrl = await getStripeReceiptUrl(
          updateData.payment_intent_id,
          creds
        ).catch(() => null);
        if (receiptUrl) {
          updateData.payment_receipt_url = receiptUrl;
        }
      }
      await applyOrderStatusTransition(orderId, status, updateData, db);
      await settleOrderIfPaid(orderId, db);
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
