import type { CheckoutSessionParams } from "@repo/shared/types/vipps";
import type { Stripe } from "stripe";
import { stripe } from "./client";

/**
 * Creates a Stripe Checkout Session.
 * Returns the hosted checkout URL and session ID — no DB operations.
 */
export async function createStripeCheckoutSession(
  params: CheckoutSessionParams & { orderId: string }
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

  const lineItems = params.items.map((item) => ({
    price_data: {
      currency: params.currency.toLowerCase(),
      product_data: {
        name: item.title || item.name,
      },
      unit_amount: Math.round((item.unit_price ?? item.price) * 100),
    },
    quantity: item.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: `${baseUrl}/shop/order/${params.orderId}?success=true`,
    cancel_url: `${baseUrl}/shop/cart?cancelled=true`,
    customer_email: params.customerInfo?.email,
    metadata: {
      orderId: params.orderId,
      userId: params.userId,
    },
  });

  if (!session.url) {
    throw new Error("Stripe checkout session has no URL");
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

/**
 * Parses and verifies a Stripe webhook event from the raw request body and signature.
 * Must be called with the raw (unparsed) request body.
 */
export function constructStripeWebhookEvent(
  rawBody: string,
  sig: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, sig, secret);
}
