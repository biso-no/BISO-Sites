import { createAdminClient } from "@repo/api/server";
import { OrderStatus } from "@repo/api/types/appwrite";
import { constructStripeWebhookEvent } from "@repo/payment/stripe";
import { triggerMembershipSync } from "@repo/shared/utils/membership-sync";
import { getOrderByPaymentSessionId } from "@repo/shared/utils/vipps-order-ops";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return NextResponse.json(
        { success: false, message: "Missing Stripe signature" },
        { status: 400 }
      );
    }

    const event = constructStripeWebhookEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    const { db } = await createAdminClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          id: string;
          payment_intent?: string;
          receipt_url?: string;
        };
        const found = await getOrderByPaymentSessionId(session.id, db);
        if (!found) {
          console.error(
            `[Stripe Webhook] Order not found for session: ${session.id}`
          );
          break;
        }
        const { orderId, order } = found;
        await db.updateRow(
          process.env.APPWRITE_DATABASE_ID!,
          process.env.APPWRITE_ORDERS_COLLECTION_ID!,
          orderId,
          {
            status: OrderStatus.PAID,
            payment_intent_id: session.payment_intent || null,
            payment_receipt_url: session.receipt_url || null,
          }
        );
        console.log(`[Stripe Webhook] Order ${orderId} → PAID`);
        triggerMembershipSync(order, db).catch((err) =>
          console.error("[Stripe Webhook] Membership sync error:", err)
        );
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as { id: string };
        const found = await getOrderByPaymentSessionId(session.id, db);
        if (!found) {
          console.error(
            `[Stripe Webhook] Order not found for session: ${session.id}`
          );
          break;
        }
        const { orderId } = found;
        await db.updateRow(
          process.env.APPWRITE_DATABASE_ID!,
          process.env.APPWRITE_ORDERS_COLLECTION_ID!,
          orderId,
          { status: OrderStatus.CANCELLED }
        );
        console.log(`[Stripe Webhook] Order ${orderId} → CANCELLED`);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error);
    return NextResponse.json(
      { success: false, message: "Webhook processing failed" },
      { status: 400 }
    );
  }
}
