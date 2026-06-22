import Stripe from "stripe";

/**
 * Builds a Stripe SDK client from a resolved secret key. Credentials are
 * always passed in (never read from `process.env` here) so the managed
 * test/live configuration drives which account is used.
 */
export function buildStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}
