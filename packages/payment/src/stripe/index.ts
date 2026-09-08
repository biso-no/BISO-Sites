import type Stripe from "stripe";
import type { StripeCredentials } from "../credentials/types";
import type { CheckoutSessionParams } from "../vipps/types";
import { buildStripeClient } from "./client";
import type { StripeCheckoutUrls } from "./types";

export type { StripeCheckoutUrls } from "./types";

/**
 * Builds Stripe Checkout line items from cart items. Amounts are converted to
 * the smallest currency unit (øre) and rounded — mirrors the Vipps line-item
 * math so both providers charge the same total.
 */
export function buildStripeLineItems(
  items: CheckoutSessionParams["items"],
  currency: string
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: currency.toLowerCase(),
      unit_amount: Math.round((item.unit_price ?? item.price) * 100),
      product_data: { name: item.title || item.name },
    },
  }));
}

/**
 * Creates a Stripe Checkout Session (hosted redirect). Returns only the
 * checkout URL and session id — no DB operations — matching the Vipps shape.
 */
export async function createStripeCheckoutSession(
  params: CheckoutSessionParams & { orderId: string },
  creds: StripeCredentials,
  urls: StripeCheckoutUrls
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const stripe = buildStripeClient(creds.secretKey);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: buildStripeLineItems(params.items, params.currency),
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    client_reference_id: params.orderId,
    customer_email: params.customerInfo?.email,
    metadata: { orderId: params.orderId, reference: params.reference },
  });

  if (!session.url) {
    throw new Error("Stripe checkout session was created without a URL");
  }

  return { checkoutUrl: session.url, sessionId: session.id };
}

/** Retrieves a Checkout Session for return/callback verification. */
export async function getStripeSession(
  sessionId: string,
  creds: StripeCredentials
): Promise<{ session: Stripe.Checkout.Session }> {
  const stripe = buildStripeClient(creds.secretKey);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return { session };
}

/**
 * Verifies a Stripe webhook signature and returns the parsed event.
 * Throws when the signature does not match `creds.webhookSecret`.
 */
export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string,
  creds: StripeCredentials
): Stripe.Event {
  const stripe = buildStripeClient(creds.secretKey);
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    creds.webhookSecret
  );
}

/**
 * Refunds (part of) a settled payment. `amountMinor` is in the smallest
 * currency unit (øre); omit it to refund the full remaining amount.
 *
 * Stripe honours a caller-supplied idempotency key, so a retried or
 * double-submitted refund with the same key returns the original refund
 * instead of moving money twice.
 */
export async function refundStripePayment(
  paymentIntentId: string,
  amountMinor: number | undefined,
  creds: StripeCredentials,
  opts: { idempotencyKey: string; reason?: string }
): Promise<{ amountMinor: number; id: string; status: string }> {
  const stripe = buildStripeClient(creds.secretKey);

  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      ...(amountMinor === undefined ? {} : { amount: amountMinor }),
      // `reason` is a closed Stripe enum; free-text belongs in metadata.
      ...(opts.reason
        ? { metadata: { reason: opts.reason.slice(0, 500) } }
        : {}),
    },
    { idempotencyKey: opts.idempotencyKey }
  );

  return {
    amountMinor: refund.amount,
    id: refund.id,
    status: refund.status ?? "unknown",
  };
}

/**
 * Total already refunded against a PaymentIntent, in minor units. Read back
 * from Stripe rather than summed locally so a refund issued directly in the
 * Stripe dashboard is still reflected.
 */
export async function getStripeRefundedTotal(
  paymentIntentId: string,
  creds: StripeCredentials
): Promise<number> {
  const stripe = buildStripeClient(creds.secretKey);
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  const charge = intent.latest_charge;
  if (charge && typeof charge !== "string") {
    return charge.amount_refunded ?? 0;
  }
  return 0;
}

/**
 * The hosted Stripe receipt for a settled payment, used to populate
 * `orders.payment_receipt_url`. Returns `null` when the payment has no charge
 * yet (or Stripe omits the receipt), so callers can store nothing rather than
 * a broken link.
 */
export async function getStripeReceiptUrl(
  paymentIntentId: string,
  creds: StripeCredentials
): Promise<string | null> {
  const stripe = buildStripeClient(creds.secretKey);
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  const charge = intent.latest_charge;
  if (charge && typeof charge !== "string") {
    return charge.receipt_url ?? null;
  }
  return null;
}
