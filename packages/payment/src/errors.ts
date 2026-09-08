/**
 * Refund failure classification.
 *
 * The distinction that matters for money: did the provider definitively refuse
 * (no funds moved, safe to release the balance and let the operator retry), or
 * is the outcome unknown (the request may have been accepted before the
 * response was lost)?
 *
 * Treating the second as the first is how an order gets refunded twice: the
 * balance is released, and a retry mints a fresh idempotency key — the Vipps
 * SDK generates one per request, so the provider cannot deduplicate it either.
 * Only throw `PaymentRefundRejectedError` when the provider actually answered
 * and said no.
 */
export class PaymentRefundRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentRefundRejectedError";
  }
}

/** Whether a caught error is a definitive provider rejection. */
export function isRefundRejection(error: unknown): boolean {
  return error instanceof PaymentRefundRejectedError;
}
