import { type Orders, OrdersStatus } from "@repo/api/types/appwrite";
import type { VippsPaymentSnapshot, VippsState } from "../types/vipps";

const ZERO = 0;

/** Coerces a Vipps minor-unit amount (number, numeric string, or null) to a number. */
function minor(value?: number | string | null): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : ZERO;
  }
  return ZERO;
}

function statusForState(state: VippsState): OrdersStatus {
  switch (state) {
    case "CREATED":
      return OrdersStatus.PENDING;
    case "AUTHORIZED":
      return OrdersStatus.AUTHORIZED;
    case "ABORTED":
    case "EXPIRED":
      return OrdersStatus.CANCELLED;
    case "TERMINATED":
      return OrdersStatus.FAILED;
    default:
      return OrdersStatus.PENDING;
  }
}

/**
 * Maps an ePayment payment snapshot to an order status + column updates.
 *
 * The ePayment API keeps a payment in `AUTHORIZED` even after it has been
 * captured, cancelled, or refunded — those are reflected in the aggregate
 * amounts, not the state. So the aggregate totals take precedence:
 * captured → PAID, fully refunded → REFUNDED, cancelled → CANCELLED. Only when
 * no money has moved do we fall back to the raw state (ABORTED/EXPIRED →
 * CANCELLED, TERMINATED → FAILED).
 */
export function determineStatusFromPaymentState(snapshot: VippsPaymentSnapshot): {
  status: OrdersStatus;
  updateData: Partial<Orders>;
} {
  const updateData: Partial<Orders> = {};
  if (snapshot.pspReference) {
    updateData.payment_intent_id = snapshot.pspReference;
  }

  const captured = minor(snapshot.aggregate?.capturedAmount?.value);
  const refunded = minor(snapshot.aggregate?.refundedAmount?.value);
  const cancelled = minor(snapshot.aggregate?.cancelledAmount?.value);

  if (refunded > ZERO && refunded >= captured) {
    return { status: OrdersStatus.REFUNDED, updateData };
  }
  if (captured > ZERO) {
    return { status: OrdersStatus.PAID, updateData };
  }
  if (cancelled > ZERO) {
    return { status: OrdersStatus.CANCELLED, updateData };
  }

  return { status: statusForState(snapshot.state), updateData };
}
