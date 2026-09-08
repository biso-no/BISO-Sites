/**
 * Provider-agnostic refund execution.
 *
 * Both providers are driven from one shape so the order orchestrator in
 * `@repo/shared/utils/order-refunds` never branches on provider. Amounts cross
 * this boundary in MINOR units (øre) — the same unit both provider APIs use —
 * and the caller converts to/from NOK.
 *
 * A note on idempotency: the Vipps SDK generates a fresh `Idempotency-Key` on
 * every request (see `base_client_helper.ts`), so an accidental second call
 * refunds a second time. Stripe honours the key we pass. Neither is sufficient
 * on its own, which is why the orchestrator holds an atomic `refund_lock`
 * claim across the provider call for both providers.
 */

import type { StripeCredentials, VippsCredentials } from "./credentials/types";

export { isRefundRejection, PaymentRefundRejectedError } from "./errors";

import { getStripeRefundedTotal, refundStripePayment } from "./stripe";
import { cancelVippsPayment, refundVippsPayment } from "./vipps";

export type RefundProvider = "vipps" | "stripe";

export interface RefundRequest {
  /** Minor units (øre) to refund. */
  amountMinor: number;
  currency: string;
  /** Sent to Stripe; ignored by Vipps, which mints its own per request. */
  idempotencyKey: string;
  provider: RefundProvider;
  reason?: string;
  /**
   * Vipps: the ePayment `reference` (`orders.payment_session_id`).
   * Stripe: the PaymentIntent id (`orders.payment_intent_id`).
   */
  reference: string;
}

export interface RefundOutcome {
  /** Stripe `re_…`; Vipps has no refund id, so its pspReference stands in. */
  providerRefundId?: string;
  /**
   * Total refunded against this payment after the call, in minor units, as
   * reported by the provider. Authoritative — it also accounts for refunds
   * issued outside this system (e.g. straight from the Stripe dashboard).
   */
  refundedTotalMinor: number;
  /**
   * Whether the provider has actually moved the money. False means the refund
   * was accepted but is still in flight (Stripe's `pending` state), so the
   * caller must leave the attempt open rather than restocking inventory and
   * reversing the ledger against funds that have not been returned yet.
   */
  settled: boolean;
}

export type RefundCredentials =
  | { provider: "stripe"; stripe: StripeCredentials }
  | { provider: "vipps"; vipps: VippsCredentials };

function amountValue(amount?: { value?: number } | null): number {
  return typeof amount?.value === "number" ? amount.value : 0;
}

/**
 * Executes one refund against the payment provider. Throws on provider
 * failure — the caller records the failure on the refund row.
 */
export async function refundPayment(
  request: RefundRequest,
  creds: RefundCredentials
): Promise<RefundOutcome> {
  if (request.provider === "vipps") {
    if (creds.provider !== "vipps") {
      throw new Error("Vipps refund requires Vipps credentials");
    }
    const snapshot = await refundVippsPayment(
      request.reference,
      { currency: request.currency, value: request.amountMinor },
      creds.vipps
    );
    // Vipps ePayment refunds are synchronous: a non-error response means the
    // aggregate already reflects the returned funds.
    return {
      refundedTotalMinor: amountValue(snapshot.aggregate?.refundedAmount),
      providerRefundId: snapshot.pspReference,
      settled: true,
    };
  }

  if (creds.provider !== "stripe") {
    throw new Error("Stripe refund requires Stripe credentials");
  }
  const refund = await refundStripePayment(
    request.reference,
    request.amountMinor,
    creds.stripe,
    { idempotencyKey: request.idempotencyKey, reason: request.reason }
  );
  // Stripe's refund object reports only this refund's amount, so the running
  // total is read back from the PaymentIntent's charge.
  const refundedTotalMinor = await getStripeRefundedTotal(
    request.reference,
    creds.stripe
  ).catch(() => refund.amountMinor);

  return {
    refundedTotalMinor,
    providerRefundId: refund.id,
    settled: refund.settled,
  };
}

/**
 * Releases an authorized-but-uncaptured reservation. Refunding such a payment
 * is not possible — no money has moved — so the admin surface offers this
 * instead. Stripe Checkout captures automatically, so this is Vipps-only.
 */
export async function cancelPayment(
  reference: string,
  creds: RefundCredentials
): Promise<{ cancelledMinor: number }> {
  if (creds.provider !== "vipps") {
    throw new Error("Only Vipps reservations can be cancelled");
  }
  const snapshot = await cancelVippsPayment(reference, creds.vipps);
  return { cancelledMinor: amountValue(snapshot.aggregate?.cancelledAmount) };
}
