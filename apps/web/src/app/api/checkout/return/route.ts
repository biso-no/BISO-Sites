import { createAdminClient } from "@repo/api/server";
import { resolveStripeCredentials } from "@repo/payment/credentials";
import { getStripeSession } from "@repo/payment/stripe";
import { reconcileVippsPayment } from "@repo/payment/vipps";
import {
  type FinagoOrder,
  postFinagoTransactionForOrder,
} from "@repo/shared/utils/finago-order-posting";
import { determineStatusFromStripeSession } from "@repo/shared/utils/stripe-pure";
import { applyOrderStatusTransition } from "@repo/shared/utils/vipps-order-ops";
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
 * up to date even if the webhook/callback hasn't landed yet. Provider-agnostic.
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
    if (order.payment_provider === "vipps") {
      // Verify server-side: fetch the payment, capture if authorized, and apply
      // the transition idempotently (safe alongside the webhook).
      await reconcileVippsPayment(orderId, db);
    } else if (order.payment_provider === "stripe") {
      const creds = await resolveStripeCredentials(db);
      if (creds) {
        const { session } = await getStripeSession(
          order.payment_session_id,
          creds
        );
        const { status, updateData } =
          determineStatusFromStripeSession(session);
        await applyOrderStatusTransition(orderId, status, updateData, db);
      }
    }
  } catch (err) {
    console.error(
      "[Checkout Return] Provider session verification failed:",
      err
    );
  }
}

function redirectForStatus(
  status: string | null | undefined,
  orderId: string
): NextResponse {
  switch (status) {
    case "paid":
    case "authorized":
      return NextResponse.redirect(
        siteUrl(`/shop/order/${orderId}?success=true`)
      );
    case "cancelled":
      return NextResponse.redirect(
        siteUrl("/shop/cart?cancelled=true")
      );
    case "failed":
      return NextResponse.redirect(
        siteUrl("/shop/cart?error=payment_failed")
      );
    default:
      return NextResponse.redirect(
        siteUrl(`/shop/order/${orderId}`)
      );
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
 * Finago (24SO) revenue posting is attempted here as one of three redundant
 * triggers (webhook callback, this return route, reconciliation cron) — the
 * atomic posting claim inside postFinagoTransactionForOrder guarantees only
 * one of them actually posts.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      console.error("[Checkout Return] No orderId provided");
      return NextResponse.redirect(
        siteUrl("/shop")
      );
    }

    console.info(`[Checkout Return] Verifying order status for: ${orderId}`);

    const { db } = await createAdminClient();
    const order = await db.getRow<Orders>("app", "orders", orderId);

    if (!order) {
      console.error(`[Checkout Return] Order not found: ${orderId}`);
      return NextResponse.redirect(
        siteUrl("/shop?error=order_not_found")
      );
    }

    await syncOrderStatusFromProvider(order, orderId, db);

    const updatedOrder = await db.getRow<Orders>("app", "orders", orderId);
    const status = updatedOrder?.status ?? order.status;

    console.info(`[Checkout Return] Order ${orderId} status: ${status}`);

    if (status === "authorized" || status === "paid") {
      await postFinagoTransactionForOrder(orderId, db);
    }

    return redirectForStatus(status, orderId);
  } catch (error) {
    console.error("[Checkout Return] Error:", error);
    return NextResponse.redirect(
      siteUrl("/shop?error=unknown")
    );
  }
}
