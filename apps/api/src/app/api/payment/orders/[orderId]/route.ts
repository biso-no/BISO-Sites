import { createAdminClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import { reconcileOrderPayment } from "@repo/payment/reconcile";
import { getOrderItems } from "@repo/shared/utils/order-parsing";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import { settleOrderIfPaid } from "@repo/shared/utils/order-settlement";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

/**
 * The buyer's view of one of their own orders, re-synced with the payment
 * provider first.
 *
 * On the website the browser lands on `/api/checkout/return` after paying, and
 * that route reconciles the payment and settles the revenue before rendering a
 * receipt. A native app cannot rely on that hop: the buyer often comes back by
 * switching apps rather than following the redirect, and a browser may refuse
 * to hand a custom-scheme deep link back to the app at all. Without a way to
 * ask, the app would show "pending" for an order that is paid.
 *
 * So this does what the return route does, minus the redirect: reconcile,
 * settle if paid (idempotent — see `settleOrderIfPaid`), and return the order.
 *
 * Ownership is enforced against the caller's session, so one buyer can never
 * read another's order. The reconcile and settle steps run with the admin
 * client because order rows are Operations-Unit writable — the same split the
 * web `verifyOrder` action uses.
 */

interface OrderItemView {
  customFields?: Array<{ id: string; label: string; value: string }>;
  lineTotal: number;
  name: string;
  productId?: string;
  quantity: number;
  unitPrice: number;
  variationId?: string;
  variationName?: string;
}

interface OrderView {
  campusId?: string | null;
  createdAt: string;
  currency: string;
  discountTotal: number;
  id: string;
  items: OrderItemView[];
  memberDiscountPercent: number;
  membershipApplied: boolean;
  paymentLink?: string | null;
  paymentProvider?: string | null;
  receiptUrl?: string | null;
  status: string;
  subtotal: number;
  total: number;
}

function hasBearerToken(req: NextRequest): boolean {
  return req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

async function authenticate(req: NextRequest) {
  if (!hasBearerToken(req)) {
    return null;
  }
  try {
    const client = await createAuthenticatedClient(req);
    const user = await client.account.get();
    return user?.$id ? { client, userId: user.$id } : null;
  } catch {
    return null;
  }
}

function toOrderView(
  order: Orders & { $id: string; $createdAt: string }
): OrderView {
  return {
    campusId: order.campus_id ?? null,
    createdAt: order.$createdAt,
    currency: order.currency ?? "NOK",
    discountTotal: order.discount_total ?? 0,
    id: order.$id,
    items: getOrderItems(order).map((item) => {
      const unitPrice = Number(item.unit_price ?? item.price ?? 0);
      const quantity = typeof item.quantity === "number" ? item.quantity : 0;
      return {
        customFields: item.custom_fields,
        lineTotal:
          typeof item.line_total === "number"
            ? item.line_total
            : unitPrice * quantity,
        name: item.title ?? item.name ?? "",
        productId: item.product_id ?? undefined,
        quantity,
        unitPrice,
        variationId:
          typeof item.variation_id === "string" ? item.variation_id : undefined,
        variationName:
          typeof item.variation_name === "string"
            ? item.variation_name
            : undefined,
      };
    }),
    memberDiscountPercent: order.member_discount_percent ?? 0,
    membershipApplied: Boolean(order.membership_applied),
    paymentProvider: order.payment_provider ?? null,
    paymentLink: order.payment_link ?? null,
    receiptUrl: order.payment_receipt_url ?? order.receipt_link ?? null,
    status: order.status ?? "pending",
    subtotal: order.subtotal ?? 0,
    total: order.total ?? 0,
  };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  const { orderId } = await ctx.params;

  try {
    const auth = await authenticate(req);
    if (!auth) {
      return json({ message: "Authentication required" }, 401);
    }

    // Read through the caller's own session first. Order rows are row-secured
    // to their buyer, so a row that is not theirs simply is not found — the
    // ownership check and the existence check are the same read.
    type StoredOrder = Orders & { $id: string; $createdAt: string };
    const own = await auth.client.db
      .getRow<StoredOrder>("app", "orders", orderId, [ORDER_ITEMS_SELECT])
      .catch(() => null);
    if (!own) {
      return json({ message: "Order not found" }, 404);
    }

    // Belt and braces: an order row could in principle be readable for another
    // reason, so re-check the buyer explicitly before returning it.
    if (own.userId && own.userId !== auth.userId) {
      return json({ message: "Order not found" }, 404);
    }

    // A settled order needs no provider round-trip.
    if (own.status === "paid" || own.status === "refunded") {
      return json(toOrderView(own));
    }

    const { db } = await createAdminClient();
    await reconcileOrderPayment(orderId, db).catch((error) => {
      console.error(`[payment/orders/${orderId}] reconcile failed:`, error);
    });
    await settleOrderIfPaid(orderId, db);

    const refreshed = await auth.client.db
      .getRow<StoredOrder>("app", "orders", orderId, [ORDER_ITEMS_SELECT])
      .catch(() => null);

    return json(toOrderView(refreshed ?? own));
  } catch (error) {
    console.error(`[payment/orders/${orderId}] error:`, error);
    return json({ message: "Failed to load order" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
