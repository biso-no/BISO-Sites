import { type Orders, OrdersStatus } from "@repo/api/types/appwrite";

/**
 * The subset of a Stripe Checkout Session we map to an order status. Kept
 * structural so callers can pass a real `Stripe.Checkout.Session` or a minimal
 * test double.
 */
export interface StripeSessionLike {
  payment_intent?: string | { id?: string | null } | null;
  /** "paid" | "unpaid" | "no_payment_required" */
  payment_status?: string | null;
  /** "open" | "complete" | "expired" */
  status?: string | null;
}

function paymentIntentId(session: StripeSessionLike): string | null {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }
  return session.payment_intent?.id ?? null;
}

/**
 * Maps a Stripe Checkout Session (+ the webhook event type, when available) to
 * an order status + the order columns to update.
 *
 * Checkout is created with `mode: "payment"` and the default *automatic*
 * capture, so there is no authorize-only state: a synchronous card payment
 * arrives as `complete`/`paid`. A `complete`/`unpaid` session means a
 * delayed-notification method is still settling — it must NOT be treated as
 * fulfilled (doing so prematurely decrements stock and posts revenue for a
 * payment that can still fail). Fulfillment happens only when the payment
 * actually settles (`paid`, via `checkout.session.async_payment_succeeded`).
 *
 * - `async_payment_failed` event → CANCELLED (session is still complete/unpaid)
 * - `expired` session → CANCELLED
 * - paid (or no-payment-required) → PAID
 * - otherwise (complete-but-unpaid / still open) → PENDING
 */
export function determineStatusFromStripeSession(
  session: StripeSessionLike,
  eventType?: string
): {
  status: OrdersStatus;
  updateData: Partial<Orders>;
} {
  const updateData: Partial<Orders> = {};
  const intentId = paymentIntentId(session);
  if (intentId) {
    updateData.payment_intent_id = intentId;
  }

  // A delayed-notification payment that failed. The session shape is
  // indistinguishable from "still settling" (complete/unpaid), so the event
  // type is the only reliable signal — handle it before any success mapping.
  if (eventType === "checkout.session.async_payment_failed") {
    return { status: OrdersStatus.CANCELLED, updateData };
  }

  if (session.status === "expired") {
    return { status: OrdersStatus.CANCELLED, updateData };
  }

  if (
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required"
  ) {
    return { status: OrdersStatus.PAID, updateData };
  }

  return { status: OrdersStatus.PENDING, updateData };
}
