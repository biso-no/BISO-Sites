import { createSessionClient } from "@repo/api/server";
import { getVippsSession } from "@repo/payment/vipps";
import { updateOrderStatus } from "@repo/shared/utils/vipps-order-ops";
import { NextResponse } from "next/server";

/**
 * Checkout Return Endpoint
 *
 * Redirects here after completing (or cancelling) payment with Vipps.
 * Verifies order status with Vipps to ensure it's up-to-date before showing result.
 * Handles race conditions where the webhook might not have been processed yet.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      console.error("[Checkout Return] No orderId provided");
      return NextResponse.redirect(
        new URL("/shop", process.env.NEXT_PUBLIC_BASE_URL)
      );
    }

    console.log(`[Checkout Return] Verifying order status for: ${orderId}`);

    const { db } = await createSessionClient();
    const order = await db.getRow("app", "orders", orderId);

    if (!order) {
      console.error(`[Checkout Return] Order not found: ${orderId}`);
      return NextResponse.redirect(
        new URL("/shop?error=order_not_found", process.env.NEXT_PUBLIC_BASE_URL)
      );
    }

    if (order.payment_session_id && order.payment_provider === "vipps") {
      try {
        const { paymentState, sessionData } = await getVippsSession(
          order.payment_session_id
        );
        await updateOrderStatus(orderId, paymentState, sessionData, db);
      } catch (err) {
        console.error("[Checkout Return] Vipps session verification failed:", err);
      }
    }

    const updatedOrder = await db.getRow("app", "orders", orderId);
    const status = updatedOrder?.status ?? order.status;

    console.log(`[Checkout Return] Order ${orderId} status: ${status}`);

    switch (status) {
      case "paid":
      case "authorized":
        return NextResponse.redirect(
          new URL(
            `/shop/order/${orderId}?success=true`,
            process.env.NEXT_PUBLIC_BASE_URL
          )
        );
      case "cancelled":
        return NextResponse.redirect(
          new URL("/shop/cart?cancelled=true", process.env.NEXT_PUBLIC_BASE_URL)
        );
      case "failed":
        return NextResponse.redirect(
          new URL(
            "/shop/cart?error=payment_failed",
            process.env.NEXT_PUBLIC_BASE_URL
          )
        );
      default:
        return NextResponse.redirect(
          new URL(`/shop/order/${orderId}`, process.env.NEXT_PUBLIC_BASE_URL)
        );
    }
  } catch (error) {
    console.error("[Checkout Return] Error:", error);
    return NextResponse.redirect(
      new URL("/shop?error=unknown", process.env.NEXT_PUBLIC_BASE_URL)
    );
  }
}
