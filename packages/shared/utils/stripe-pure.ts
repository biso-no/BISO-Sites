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
 * Maps a Stripe Checkout Session to an order status + the order columns to
 * update. Mirrors `determineStatusFromPaymentState` (Vipps) so both providers
 * feed the same `applyOrderStatusTransition` stock/lifecycle logic.
 *
 * - `expired` session → CANCELLED
 * - paid (or no-payment-required) → PAID
 * - completed but not yet paid → AUTHORIZED
 * - otherwise (still open) → PENDING
 */
export function determineStatusFromStripeSession(session: StripeSessionLike): {
  status: OrdersStatus;
  updateData: Partial<Orders>;
} {
  const updateData: Partial<Orders> = {};
  const intentId = paymentIntentId(session);
  if (intentId) {
    updateData.payment_intent_id = intentId;
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

  if (session.status === "complete") {
    return { status: OrdersStatus.AUTHORIZED, updateData };
  }

  return { status: OrdersStatus.PENDING, updateData };
}
