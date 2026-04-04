import { createAdminClient } from "@repo/api/server";
import {
  getOrderByPaymentSessionId,
  updateOrderStatus,
} from "@repo/shared/utils/vipps-order-ops";
import { triggerMembershipSync } from "@repo/shared/utils/membership-sync";
import { getVippsSession, verifyVippsCallbackToken } from "@repo/payment/vipps";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Vipps Checkout Webhook Callback Endpoint
 *
 * Called by Vipps when payment status changes.
 * Uses Admin client because webhooks don't have user sessions.
 *
 * States that trigger callbacks:
 * - CREATED: Payment initiated
 * - AUTHORIZED: User accepted payment
 * - ABORTED: User cancelled
 * - EXPIRED: Payment timed out
 * - TERMINATED: Merchant cancelled
 */
export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const authToken =
      headersList.get("authorization")?.replace("Bearer ", "") || "";

    const payload = await request.json();

    const sessionId =
      payload?.sessionId ||
      payload?.checkoutSessionId ||
      payload?.session?.sessionId ||
      payload?.reference;

    if (!sessionId) {
      console.error("[Vipps Callback] No session ID in payload:", payload);
      return NextResponse.json(
        { success: false, message: "Missing session ID" },
        { status: 400 }
      );
    }

    if (!verifyVippsCallbackToken(authToken)) {
      console.error("[Vipps Callback] Invalid auth token");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log(`[Vipps Callback] Processing session: ${sessionId}`);

    const { db } = await createAdminClient();

    const { paymentState, sessionData } = await getVippsSession(sessionId);

    const found = await getOrderByPaymentSessionId(sessionId, db);
    if (!found) {
      console.error(`[Vipps Callback] Order not found for session: ${sessionId}`);
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    const { orderId, order } = found;
    const { newStatus } = await updateOrderStatus(orderId, paymentState, sessionData, db);

    triggerMembershipSync(order, db).catch((err) =>
      console.error("[Vipps Callback] Membership sync error:", err)
    );

    console.log(`[Vipps Callback] Order ${orderId} → ${newStatus}`);
    return NextResponse.json(
      { success: true, orderId, status: newStatus },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Vipps Callback] Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
