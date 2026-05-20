import { createSessionClient } from "@repo/api/server";
import { postShopTransaction } from "@repo/connectors/24sevenoffice";
import { getVippsSession } from "@repo/payment/vipps";
import { parseOrderItems } from "@repo/shared/utils/order-parsing";
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
        console.error(
          "[Checkout Return] Vipps session verification failed:",
          err
        );
      }
    }

    const updatedOrder = await db.getRow("app", "orders", orderId);
    const status = updatedOrder?.status ?? order.status;

    console.log(`[Checkout Return] Order ${orderId} status: ${status}`);

    if (
      (status === "authorized" || status === "paid") &&
      !updatedOrder?.finago_transaction_id
    ) {
      try {
        const items = parseOrderItems(updatedOrder?.items_json ?? null);
        const enrichedItems = await Promise.all(
          items.map(async (item) => {
            if (!item.product_id) {
              return null;
            }
            const product = await db
              .getRow(
                process.env.APPWRITE_DATABASE_ID!,
                process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
                item.product_id
              )
              .catch(() => null);
            return {
              unit_price: Number(item.unit_price ?? item.price ?? 0),
              quantity: Number(item.quantity ?? 0),
              finago_account_number:
                (product as { finago_account_number?: number | null } | null)
                  ?.finago_account_number ?? null,
            };
          })
        );
        const transactionItems = enrichedItems.filter(
          (
            item
          ): item is {
            unit_price: number;
            quantity: number;
            finago_account_number: number | null;
          } => item !== null && item.unit_price > 0 && item.quantity > 0
        );

        const transactionId = await postShopTransaction({
          orderId,
          date: new Date().toISOString().slice(0, 10),
          total: updatedOrder?.total ?? 0,
          items: transactionItems,
          campusId: updatedOrder?.campus_id ?? null,
        });

        await db.updateRow("app", "orders", orderId, {
          finago_transaction_id: transactionId,
        });
        console.log(
          `[Finago] Posted transaction ${transactionId} for order ${orderId}`
        );
      } catch (err) {
        console.error(
          `[Finago] Failed to post transaction for order ${orderId}:`,
          err
        );
      }
    }

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
