import { createAdminClient } from "@repo/api/server";
import { createVippsCheckoutSession } from "@repo/payment/vipps";
import type { CheckoutSessionParams } from "@repo/shared/types/vipps";
import {
  createOrder,
  updateOrderWithPayment,
} from "@repo/shared/utils/vipps-order-ops";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const params = (await request.json()) as CheckoutSessionParams;

    if (
      !(
        params.userId &&
        params.items?.length &&
        params.total &&
        params.currency
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Missing required checkout params" },
        { status: 400 }
      );
    }

    const { db } = await createAdminClient();

    const { orderId } = await createOrder(params, db);

    const { checkoutUrl, sessionId } = await createVippsCheckoutSession({
      ...params,
      orderId,
    });

    await updateOrderWithPayment(orderId, sessionId, checkoutUrl, "vipps", db);

    return NextResponse.json(
      { checkoutUrl, orderId, sessionId },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Vipps Checkout] Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create Vipps checkout session" },
      { status: 500 }
    );
  }
}
