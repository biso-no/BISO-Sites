import { createSessionClient } from "@repo/api/server";
import { verifyOrderStatus } from "@repo/payment/vipps";
import { NextResponse } from "next/server";

/**
 * Checkout Return Endpoint
 *
 * This is where users are redirected after completing (or cancelling) payment with Vipps.
 * We verify the order status with Vipps to ensure it's up-to-date before showing the result.
 *
 * This handles race conditions where the webhook might not have been processed yet.
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

    // Get database client from user session
    const { db } = await createSessionClient();

    // Verify and update order status with Vipps
    const order = await verifyOrderStatus(orderId, db);

    if (!order) {
      console.error(`[Checkout Return] Order not found: ${orderId}`);
      return NextResponse.redirect(
        new URL("/shop?error=order_not_found", process.env.NEXT_PUBLIC_BASE_URL)
      );
    }

    console.log(`[Checkout Return] Order ${orderId} status: ${order.status}`);

    // Redirect based on order status
    switch (order.status) {
      case "paid":
      case "authorized":
        // Success - redirect to success page
        return NextResponse.redirect(
          new URL(
            `/shop/order/${orderId}?success=true`,
            process.env.NEXT_PUBLIC_BASE_URL
          )
        );
      case "cancelled":
        // User cancelled - redirect back to cart
        return NextResponse.redirect(
          new URL("/shop/cart?cancelled=true", process.env.NEXT_PUBLIC_BASE_URL)
        );
      case "failed":
        // Payment failed - redirect with error
        return NextResponse.redirect(
          new URL(
            "/shop/cart?error=payment_failed",
            process.env.NEXT_PUBLIC_BASE_URL
          )
        );
      default:
        // Still pending or unknown - redirect to order page
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
