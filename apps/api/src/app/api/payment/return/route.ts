import { createAdminClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import { reconcileOrderPayment } from "@repo/payment/reconcile";
import {
  appCartDeepLink,
  appOrderDeepLink,
  appShopDeepLink,
  CHECKOUT_CANCELLED_PARAM,
  CHECKOUT_CLIENT_PARAM,
} from "@repo/shared/utils/checkout-return";
import { isMembershipOrder } from "@repo/shared/utils/membership-fulfilment";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import { settleOrderIfPaid } from "@repo/shared/utils/order-settlement";
import { NextResponse } from "next/server";
import { webBaseUrl } from "@/lib/public-urls";

export const dynamic = "force-dynamic";

// Buyers land here straight after paying. A missing web origin must still
// produce a redirect for a customer who has already been charged.
const FALLBACK_WEB_URL = "https://biso.no";

function siteUrl(path: string): URL {
  return new URL(path, webBaseUrl() ?? FALLBACK_WEB_URL);
}

/**
 * A checkout that started in the native app comes back through this same
 * route but must end up in the app. The status rides along so the app can
 * render the outcome straight away; it verifies independently as well,
 * because a browser is free to drop a custom-scheme redirect.
 */
function redirectToApp(
  status: string | null | undefined,
  orderId: string,
  cancelled: boolean
): NextResponse {
  const settled = status === "paid" || status === "authorized";
  // A cancelled Stripe session reconciles to `pending`, so the marker on the
  // cancel URL is honoured only while the order has not actually settled. A
  // Vipps payment the buyer abandons reconciles to `cancelled` outright.
  if ((cancelled && !settled) || status === "cancelled") {
    return NextResponse.redirect(appCartDeepLink(true));
  }
  return NextResponse.redirect(appOrderDeepLink(orderId, status));
}

/**
 * Paid, authorized and pending orders go to the shared receipt page, which
 * renders memberships too. Cancelled and failed membership purchases go back
 * to the join flow, because a membership buyer never touched the cart.
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
 * Payment return endpoint.
 *
 * Payment providers redirect buyers here after completing (or cancelling)
 * payment. Re-syncs the order with the provider so the result page is current
 * even if the webhook has not landed, then settles revenue through
 * `settleOrderIfPaid` — one of three redundant triggers (webhook, this route,
 * reconcile cron); the claim locks inside it make settlement exactly-once.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const isAppCheckout = searchParams.get(CHECKOUT_CLIENT_PARAM) === "app";
  const isCancelled = searchParams.get(CHECKOUT_CANCELLED_PARAM) === "1";

  const failureRedirect = (webPath: string) => {
    if (!isAppCheckout) {
      return NextResponse.redirect(siteUrl(webPath));
    }
    return NextResponse.redirect(
      orderId ? appOrderDeepLink(orderId, null) : appShopDeepLink()
    );
  };

  try {
    if (!orderId) {
      console.error("[payment/return] No orderId provided");
      return failureRedirect("/shop");
    }

    const { db } = await createAdminClient();
    const order = await db.getRow<Orders>("app", "orders", orderId, [
      ORDER_ITEMS_SELECT,
    ]);
    if (!order) {
      return failureRedirect("/shop?error=order_not_found");
    }

    if (order.payment_session_id) {
      await reconcileOrderPayment(orderId, db).catch((error) => {
        console.error("[payment/return] Provider verification failed:", error);
      });
    }

    const refreshed = await db
      .getRow<Orders>("app", "orders", orderId, [ORDER_ITEMS_SELECT])
      .catch(() => null);
    const current = refreshed ?? order;

    await settleOrderIfPaid(orderId, db);

    return isAppCheckout
      ? redirectToApp(current.status, orderId, isCancelled)
      : redirectForStatus(current.status, orderId, isMembershipOrder(current));
  } catch (error) {
    console.error("[payment/return] Error:", error);
    return failureRedirect("/shop?error=unknown");
  }
}
