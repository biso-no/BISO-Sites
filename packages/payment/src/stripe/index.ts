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
