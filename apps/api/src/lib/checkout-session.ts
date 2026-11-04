import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { createStripeCheckoutSession } from "@repo/payment/stripe";
import { createVippsPayment } from "@repo/payment/vipps";
import type { CheckoutSessionParams } from "@repo/shared/types/vipps";
import {
  type CheckoutClient,
  checkoutReturnUrl,
} from "@repo/shared/utils/checkout-return";
import { createOrder } from "@repo/shared/utils/vipps-order-ops";
import type { NextRequest } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import type { CheckoutDb } from "@/lib/checkout-pricing";
import type { PublicUrls } from "@/lib/public-urls";

/*
 * Starting a hosted payment session, shared by the shop checkout
 * (`/api/payment/[provider]/checkout`) and the membership checkout
 * (`/api/payment/[provider]/membership-checkout`): who the buyer is, the
 * order, and the Vipps or Stripe session behind a deadline.
 */

// Neither payment helper has an internal timeout, so a hung provider call
// would otherwise hang the request indefinitely instead of surfacing as a 504.
const DEFAULT_VIPPS_CHECKOUT_TIMEOUT_MS = 10_000;

export type SessionOutcome =
  | {
      ok: true;
      orderId: string;
      session: { checkoutUrl: string; sessionId: string };
    }
  | { ok: false; message: string; status: number };

/** Thrown when a provider call misses its deadline; the routes answer 504. */
export class CheckoutTimeoutError extends Error {}

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function vippsCheckoutTimeoutMs(): number {
  return readPositiveInteger(
    process.env.VIPPS_CHECKOUT_TIMEOUT_MS,
    DEFAULT_VIPPS_CHECKOUT_TIMEOUT_MS
  );
}

async function withDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new CheckoutTimeoutError(message));
    }, timeoutMs);
    timeout.unref?.();
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function hasBearerToken(req: NextRequest): boolean {
  return req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

/** The signed-in buyer behind a Bearer JWT, or null. */
export async function authenticateBuyer(req: NextRequest) {
  if (!hasBearerToken(req)) {
    return null;
  }
  try {
    const client = await createAuthenticatedClient(req);
    const user = await client.account.get();
    return user?.$id ? { client, userId: user.$id } : null;
  } catch {
    return null;
  }
}

// Resolve credentials before creating the order so a misconfigured provider
// doesn't leave an orphan PENDING order.
export async function startVippsCheckout(
  params: CheckoutSessionParams,
  db: CheckoutDb,
  urls: PublicUrls,
  client: CheckoutClient
): Promise<SessionOutcome> {
  const creds = await resolveVippsCredentials(db);
  if (!creds) {
    return { ok: false, message: "Vipps is not configured", status: 503 };
  }

  const { orderId, order } = await createOrder(params, db);
  // The ePayment `reference` is the order id; the redirect target is the API
  // return route. The amount is taken from the persisted order total rather
  // than the pre-persist `params.total`.
  const returnUrl = checkoutReturnUrl(urls.apiBase, orderId, client);
  const payment = await withDeadline(
    createVippsPayment(
      { ...params, total: order.total ?? params.total, orderId },
      creds,
      { returnUrl }
    ),
    vippsCheckoutTimeoutMs(),
    "Vipps checkout timed out"
  );

  return {
    ok: true,
    orderId,
    session: { checkoutUrl: payment.checkoutUrl, sessionId: payment.reference },
  };
}

/**
 * `webCancelPath` is where a web buyer who cancels lands on the website, e.g.
 * `/shop/cart?cancelled=true`.
 */
export async function startStripeCheckout(
  params: CheckoutSessionParams,
  db: CheckoutDb,
  urls: PublicUrls,
  client: CheckoutClient,
  webCancelPath: string
): Promise<SessionOutcome> {
  const creds = await resolveStripeCredentials(db);
  if (!creds) {
    return { ok: false, message: "Stripe is not configured", status: 503 };
  }

  const { orderId } = await createOrder(params, db);
  const successUrl = checkoutReturnUrl(urls.apiBase, orderId, client);
  // App buyers come back through the return route on cancel too — Stripe only
  // accepts http(s) here, so a `biso://` cancel URL is not an option. The
  // marker is what keeps the two apart: a cancelled Stripe session is left
  // open and unpaid, which reconciles to `pending`, so without it the app
  // would be told to keep waiting for a payment the buyer just abandoned.
  const cancelUrl =
    client === "app"
      ? checkoutReturnUrl(urls.apiBase, orderId, client, { cancelled: true })
      : `${urls.webBase}${webCancelPath}`;
  // Same deadline discipline as the Vipps branch — a stalled Stripe call must
  // surface as a 504 instead of hanging the checkout request.
  const session = await withDeadline(
    createStripeCheckoutSession({ ...params, orderId }, creds, {
      successUrl,
      cancelUrl,
    }),
    vippsCheckoutTimeoutMs(),
    "Stripe checkout timed out"
  );

  return { ok: true, orderId, session };
}
