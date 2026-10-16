import type Stripe from "stripe";
import type { StripeCredentials } from "../credentials/types";
import { PaymentRefundRejectedError } from "../errors";
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
// Stripe error types that mean the request was understood and refused, so no
// funds moved. Everything else (connection, rate limit, generic API error) may
// have been accepted before the response was lost and must stay ambiguous.
const DEFINITIVE_STRIPE_ERRORS = new Set([
  "StripeCardError",
  "StripeInvalidRequestError",
  "StripeIdempotencyError",
]);

/** Refund states in which Stripe has definitively not moved the money. */
const REJECTED_REFUND_STATUSES = new Set(["failed", "canceled"]);

export async function refundStripePayment(
  paymentIntentId: string,
  amountMinor: number | undefined,
  creds: StripeCredentials,
  opts: { idempotencyKey: string; reason?: string }
): Promise<{ amountMinor: number; id: string; settled: boolean }> {
  const stripe = buildStripeClient(creds.secretKey);

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
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
  } catch (error) {
    const type = (error as { type?: string } | null)?.type;
    if (type && DEFINITIVE_STRIPE_ERRORS.has(type)) {
      throw new PaymentRefundRejectedError(
        `Stripe refused the refund: ${(error as Error).message}`
      );
    }
    throw error;
  }

  const status = refund.status ?? "unknown";
  if (REJECTED_REFUND_STATUSES.has(status)) {
    throw new PaymentRefundRejectedError(
      `Stripe refund ${refund.id} came back ${status}`
    );
  }

  // `pending` is a real Stripe state for slower payment methods: the refund is
  // accepted but the money has not moved yet. Reporting it as settled would
  // restock inventory and reverse the ledger for funds still in flight, so the
  // caller is told to leave the attempt open instead.
  return {
    amountMinor: refund.amount,
    id: refund.id,
    settled: status === "succeeded",
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

/**
 * Current state of a refund we already submitted, used to resolve an attempt
 * left pending. Read back from Stripe rather than inferred locally, so a
 * refund that later failed is recognised as failed.
 */
export async function getStripeRefundState(
  refundId: string,
  creds: StripeCredentials
): Promise<{ failed: boolean; settled: boolean }> {
  const stripe = buildStripeClient(creds.secretKey);
  const refund = await stripe.refunds.retrieve(refundId);
  const status = refund.status ?? "unknown";
  return {
    failed: REJECTED_REFUND_STATUSES.has(status),
    settled: status === "succeeded",
  };
}

/**
 * Whether a Checkout Session's PaymentIntent has definitively failed.
 *
 * A delayed-notification payment that fails leaves the session `complete` /
 * `unpaid` — shape-identical to one still settling — so the session alone
 * cannot tell them apart. Only the `async_payment_failed` webhook carries that
 * signal, and if it is missed the order would stay PENDING forever. The
 * PaymentIntent is the authoritative fallback.
 */
export async function hasStripePaymentFailed(
  paymentIntentId: string,
  creds: StripeCredentials
): Promise<boolean> {
  const stripe = buildStripeClient(creds.secretKey);
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return (
    intent.status === "canceled" || intent.status === "requires_payment_method"
  );
}
