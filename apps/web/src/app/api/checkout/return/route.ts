import { createAdminClient } from "@repo/api/server";
import type {
  Orders as BaseOrders,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { postShopTransaction } from "@repo/connectors/24sevenoffice";
import { resolveStripeCredentials } from "@repo/payment/credentials";
import { getStripeSession } from "@repo/payment/stripe";
import { reconcileVippsPayment } from "@repo/payment/vipps";
import { parseOrderItems } from "@repo/shared/utils/order-parsing";
import { determineStatusFromStripeSession } from "@repo/shared/utils/stripe-pure";
import { applyOrderStatusTransition } from "@repo/shared/utils/vipps-order-ops";
import { NextResponse } from "next/server";

// finago_transaction_id lives on the Appwrite "orders" table but is not
// in the generated types (the schema source-of-truth is the Appwrite CLI
// config, which is regenerated separately). Extend the type locally
// until the column is added to packages/api/types/appwrite.ts.
type Orders = BaseOrders & { finago_transaction_id?: string | null };

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

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

async function buildFinagoItems(order: Orders | null, db: AdminDb) {
  const items = parseOrderItems(order?.items_json ?? null);
  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      if (!item.product_id) {
        return null;
      }
      const product = await db
        .getRow<WebshopProducts & { finago_account_number?: number | null }>(
          process.env.APPWRITE_DATABASE_ID!,
          process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
          item.product_id
        )
        .catch(() => null);
      return {
        unit_price: Number(item.unit_price ?? item.price ?? 0),
        quantity: Number(item.quantity ?? 0),
        finago_account_number: product?.finago_account_number ?? null,
      };
    })
  );

  return enrichedItems.filter(
    (
      item
    ): item is {
      unit_price: number;
      quantity: number;
      finago_account_number: number | null;
    } => item !== null && item.unit_price > 0 && item.quantity > 0
  );
}

/**
 * Posts the paid order to Finago (24SevenOffice). Best-effort idempotency: a
 * sentinel finago_transaction_id is claimed first so a concurrent return-URL
 * hit sees it as truthy and skips. Appwrite has no atomic check-and-set, so a
 * small race window remains; the sentinel just shrinks it to a single write.
 */
async function postFinagoTransaction(
  order: Orders | null,
  orderId: string,
  db: AdminDb
): Promise<void> {
  const claim = `PENDING_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  try {
    await db.updateRow("app", "orders", orderId, {
      finago_transaction_id: claim,
    });
  } catch (err) {
    console.error(
      `[Finago] Failed to claim Finago post slot for order ${orderId}:`,
      err
    );
  }

  try {
    const transactionItems = await buildFinagoItems(order, db);
    const transactionId = await postShopTransaction({
      orderId,
      date: new Date().toISOString().slice(0, 10),
      total: order?.total ?? 0,
      items: transactionItems,
      campusId: order?.campus_id ?? null,
    });

    await db.updateRow("app", "orders", orderId, {
      finago_transaction_id: transactionId,
    });
  } catch (err) {
    // Clear the sentinel so a future retry can take another swing, otherwise
    // the order would be stuck in PENDING_ forever.
    await db
      .updateRow("app", "orders", orderId, { finago_transaction_id: null })
      .catch(() => {
        // Already in trouble — swallow the rollback failure.
      });
    console.error(
      `[Finago] Failed to post transaction for order ${orderId}:`,
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
}

/**
 * Checkout Return Endpoint
 *
 * Redirects here after completing (or cancelling) payment with a provider.
 * Verifies order status with the provider so the result page is up to date
 * before showing the outcome, handling races where the callback may not have
 * been processed yet.
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

    console.info(`[Checkout Return] Verifying order status for: ${orderId}`);

    const { db } = await createAdminClient();
    const order = await db.getRow<Orders>("app", "orders", orderId);

    if (!order) {
      console.error(`[Checkout Return] Order not found: ${orderId}`);
      return NextResponse.redirect(
        new URL("/shop?error=order_not_found", process.env.NEXT_PUBLIC_BASE_URL)
      );
    }

    await syncOrderStatusFromProvider(order, orderId, db);

    const updatedOrder = await db.getRow<Orders>("app", "orders", orderId);
    const status = updatedOrder?.status ?? order.status;

    console.info(`[Checkout Return] Order ${orderId} status: ${status}`);

    if (
      (status === "authorized" || status === "paid") &&
      !updatedOrder?.finago_transaction_id
    ) {
      await postFinagoTransaction(updatedOrder, orderId, db);
    }

    return redirectForStatus(status, orderId);
  } catch (error) {
    console.error("[Checkout Return] Error:", error);
    return NextResponse.redirect(
      new URL("/shop?error=unknown", process.env.NEXT_PUBLIC_BASE_URL)
    );
  }
}
