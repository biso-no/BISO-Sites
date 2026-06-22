export type { CheckoutSessionParams } from "../vipps/types";

/** Redirect targets for a Stripe Checkout Session (both on the web app). */
export interface StripeCheckoutUrls {
  cancelUrl: string;
  successUrl: string;
}
