import { createAdminClient } from "@repo/api/server";
import { reconcileOrderPayment } from "@repo/payment/reconcile";
import {
  appCartDeepLink,
  appOrderDeepLink,
  appShopDeepLink,
  CHECKOUT_CANCELLED_PARAM,
  CHECKOUT_CLIENT_PARAM,
} from "@repo/shared/utils/checkout-return";
import {
  type FinagoOrder,
  postFinagoTransactionForOrder,
} from "@repo/shared/utils/finago-order-posting";
import {
  fulfilMembershipOrder,
  isMembershipOrder,
} from "@repo/shared/utils/membership-fulfilment";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import { NextResponse } from "next/server";

type Orders = FinagoOrder;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

// Buyers are redirected here straight after paying. If NEXT_PUBLIC_BASE_URL is
// missing/empty at runtime, `new URL(path, undefined)` throws — which, on this
// hot path, means a raw 500 for a customer who has already been charged. Fall
// back to the known production origin (same fallback as robots.ts/sitemap.ts)
// so a redirect is always producible.
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://biso.no";

function siteUrl(path: string): URL {
  return new URL(path, SITE_URL);
}

/**
 * Re-syncs the order status with the payment provider so the result page is
 * up to date even if the webhook/callback hasn't landed yet. The provider
 * branch lives in `@repo/payment/reconcile`, shared with the reconciliation
 * cron and the buyer-facing verify action.
 *
 * Never throws: the buyer has already been charged by the time they land here,
 * so a provider hiccup must still produce a redirect.
 */
async function syncOrderStatusFromProvider(
  order: Orders,
  orderId: string,
  db: AdminDb
): Promise<void> {
  if (!order.payment_session_id) {
    return;
  }

  try {
    await reconcileOrderPayment(orderId, db);
  } catch (err) {
    console.error(
      "[Checkout Return] Provider session verification failed:",
      err
    );
  }
}

/**
 * A checkout that started in the native app comes back through this same route
 * — the reconciliation and ledger settlement below only exist here — but must
 * end up in the app rather than on the website. The status rides along so the
 * app can render the outcome straight away; it verifies independently as well,
 * because a browser is free to drop a custom-scheme redirect.
 */
function redirectToApp(
  status: string | null | undefined,
  orderId: string,
  cancelled: boolean
): NextResponse {
  // A cancelled Stripe session stays open and unpaid, so it reconciles to
  // `pending` — the marker on the cancel URL is the only thing that tells the
  // two apart. It is honoured only while the order has not actually settled,
  // so a crafted URL can never show a paid order as cancelled. The order is
  // deliberately left pending either way, exactly as the website leaves it.
  if (cancelled && status !== "paid" && status !== "authorized") {
    return NextResponse.redirect(appCartDeepLink(true));
  }
  return NextResponse.redirect(appOrderDeepLink(orderId, status));
}

/**
 * Paid/authorized and the default (pending) case fall through to the shared
 * `/shop/order/[orderId]` status page regardless of order type — it already
 * renders membership purchases generically (see `resolvePurchaseType` there)
 * and there is no separate membership confirmation page. Cancelled/failed are
 * different: those destinations point at the shop cart, which a membership
 * buyer never touched (membership orders are created directly by
 * membership-checkout, bypassing the cart entirely), so sending them there
 * would be confusing. Route those two back to the join flow instead, matching
 * the cancelUrl the Stripe membership checkout already uses
 * (`/membership/join?cancelled=true`, see apps/api's membership-checkout
 * route) for consistency.
 */
function redirectForStatus(
  status: string | null | undefined,
  orderId: string,
  isMembership: boolean
): NextResponse {
  switch (status) {
    case "paid":
    case "authorized":
      return NextResponse.redirect(
        siteUrl(`/shop/order/${orderId}?success=true`)
      );
    case "cancelled":
      return NextResponse.redirect(
        siteUrl(
          isMembership
            ? "/membership/join?cancelled=true"
            : "/shop/cart?cancelled=true"
        )
      );
    case "failed":
      return NextResponse.redirect(
        siteUrl(
          isMembership
            ? "/membership/join?error=payment_failed"
            : "/shop/cart?error=payment_failed"
        )
      );
    default:
      return NextResponse.redirect(siteUrl(`/shop/order/${orderId}`));
  }
}

/**
 * Checkout Return Endpoint
 *
 * Redirects here after completing (or cancelling) payment with a provider.
 * Verifies order status with the provider so the result page is up to date
 * before showing the outcome, handling races where the callback may not have
 * been processed yet.
 *
 * Revenue settlement is attempted here as one of three redundant triggers
 * (webhook callback, this return route, reconciliation cron): membership
 * orders are fulfilled as a 24SO invoice (fulfilMembershipOrder), everything
 * else is posted as a shop ledger transaction (postFinagoTransactionForOrder)
 * — the atomic claim inside each helper guarantees only one of the three
 * triggers actually settles a given order.
 */
export async function GET(request: Request) {
  // Read outside the try: every exit below, including the catch, has to know
  // whether it is answering the app. Stranding a native buyer on a web error
  // page is worst precisely when something has gone wrong, since that is when
  // the app's own verification is what will resolve their order.
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const isAppCheckout = searchParams.get(CHECKOUT_CLIENT_PARAM) === "app";
  const isCancelled = searchParams.get(CHECKOUT_CANCELLED_PARAM) === "1";

  const failureRedirect = (webPath: string) => {
    if (!isAppCheckout) {
      return NextResponse.redirect(siteUrl(webPath));
    }
    // With an order id the app can still verify for itself and show a real
    // state; without one there is nothing to show but the shop.
    return NextResponse.redirect(
      orderId ? appOrderDeepLink(orderId, null) : appShopDeepLink()
    );
  };

  try {
    if (!orderId) {
      console.error("[Checkout Return] No orderId provided");
      return failureRedirect("/shop");
    }

    console.info(`[Checkout Return] Verifying order status for: ${orderId}`);

    const { db } = await createAdminClient();
    const order = await db.getRow<Orders>("app", "orders", orderId, [
      ORDER_ITEMS_SELECT,
    ]);

    if (!order) {
      console.error(`[Checkout Return] Order not found: ${orderId}`);
      return failureRedirect("/shop?error=order_not_found");
    }

    await syncOrderStatusFromProvider(order, orderId, db);

    const updatedOrder = await db.getRow<Orders>("app", "orders", orderId, [
      ORDER_ITEMS_SELECT,
    ]);
    const status = updatedOrder?.status ?? order.status;

    console.info(`[Checkout Return] Order ${orderId} status: ${status}`);

    const isMembership = isMembershipOrder(updatedOrder ?? order);

    if (status === "authorized" || status === "paid") {
      if (isMembership) {
        await fulfilMembershipOrder(orderId, db);
      } else {
        await postFinagoTransactionForOrder(orderId, db);
      }
    }

    return isAppCheckout
      ? redirectToApp(status, orderId, isCancelled)
      : redirectForStatus(status, orderId, isMembership);
  } catch (error) {
    console.error("[Checkout Return] Error:", error);
    return failureRedirect("/shop?error=unknown");
  }
}
