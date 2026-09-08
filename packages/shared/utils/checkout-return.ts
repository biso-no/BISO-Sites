/**
 * Where a buyer is sent back to after paying, per surface.
 *
 * The website and the native app share one post-payment handler
 * (`/api/checkout/return` in `apps/web`), because that handler is what
 * reconciles the payment with the provider and settles the revenue. Only the
 * final hop differs: the website renders its receipt page, the app is handed a
 * `biso://` deep link that reopens it on the order.
 *
 * The surface travels as an enum, never as a caller-supplied URL, so a checkout
 * request can never turn the return handler into an open redirect.
 */

export const CHECKOUT_CLIENTS = ["web", "app"] as const;
export type CheckoutClient = (typeof CHECKOUT_CLIENTS)[number];

/** Query parameter carrying the surface through the payment provider. */
export const CHECKOUT_CLIENT_PARAM = "client";

/**
 * Marks the provider's cancel URL, which is otherwise indistinguishable from
 * its success URL for an app checkout (both must be the return route, and
 * Stripe only accepts http(s) here so a `biso://` cancel URL is not an option).
 */
export const CHECKOUT_CANCELLED_PARAM = "cancelled";

/** Custom scheme registered by the BISO app on iOS and Android. */
const APP_SCHEME = "biso";

const TRAILING_SLASHES_RE = /\/+$/;

export function isCheckoutClient(value: unknown): value is CheckoutClient {
  return (
    typeof value === "string" &&
    (CHECKOUT_CLIENTS as readonly string[]).includes(value)
  );
}

/**
 * The URL a payment provider redirects the buyer to once payment completes,
 * is cancelled, or fails. Always the web return route — it holds the
 * reconciliation and ledger-settlement logic — with the originating surface
 * appended so that route knows where to send the buyer next.
 */
export function checkoutReturnUrl(
  webBaseUrl: string,
  orderId: string,
  client: CheckoutClient = "web",
  options: { cancelled?: boolean } = {}
): string {
  const base = webBaseUrl.replace(TRAILING_SLASHES_RE, "");
  const url = `${base}/api/checkout/return?orderId=${encodeURIComponent(orderId)}`;
  if (client === "web") {
    return url;
  }
  const marked = `${url}&${CHECKOUT_CLIENT_PARAM}=${encodeURIComponent(client)}`;
  return options.cancelled ? `${marked}&${CHECKOUT_CANCELLED_PARAM}=1` : marked;
}

/**
 * The deep link that reopens the app on an order after payment. `status` is the
 * order status as the return route resolved it, so the app can render the right
 * outcome immediately instead of waiting on its own verification round-trip
 * (it still verifies, since a deep link can be dropped by the browser).
 */
export function appOrderDeepLink(
  orderId: string,
  status: string | null | undefined
): string {
  const params = new URLSearchParams({ orderId });
  if (status) {
    params.set("status", status);
  }
  return `${APP_SCHEME}://shop/order?${params.toString()}`;
}

/**
 * Where an app buyer is sent when there is no order to show them — a cancelled
 * checkout, or a return whose order could not be read. Mirrors the website,
 * which sends a cancelled buyer back to the cart rather than to a receipt.
 */
export function appCartDeepLink(cancelled = false): string {
  return cancelled
    ? `${APP_SCHEME}://shop/cart?${CHECKOUT_CANCELLED_PARAM}=1`
    : `${APP_SCHEME}://shop/cart`;
}

/** The app's shop, for a return that carries no usable order at all. */
export function appShopDeepLink(): string {
  return `${APP_SCHEME}://shop`;
}
