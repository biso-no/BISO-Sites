"use server";

import { createAdminClient } from "@repo/api/server";
import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { type RefundCredentials, refundPayment } from "@repo/payment/refunds";
import { finagoRefundReverser } from "@repo/shared/utils/finago-refund-reverser";
import { isMembershipOrder } from "@repo/shared/utils/membership-fulfilment";
import { getOrderItems } from "@repo/shared/utils/order-parsing";
import {
  loadOrderRefunds,
  ORDER_WITH_REFUNDS_SELECT,
  type RefundableOrder,
  type RefundExecutor,
  refundOrder,
  toRecordedRefunds,
  toRefundableItems,
} from "@repo/shared/utils/order-refunds";
import { computeRefundable } from "@repo/shared/utils/order-refunds-pure";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import { canViewShopOperations } from "@/lib/roles";
import {
  type OrderDetail,
  toLineExtras,
  toOrderDetail,
} from "@/lib/shop/order-detail";
import { logAuditEvent } from "./audit-log";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

/**
 * Whether an Appwrite failure means "this row does not exist", as opposed to a
 * malformed query, a permission problem, or the service being down. Only the
 * first may be reported to the caller as a 404 — the rest must surface.
 */
function isRowNotFound(error: unknown): boolean {
  const code = (error as { code?: number } | null)?.code;
  const type = (error as { type?: string } | null)?.type;
  return (
    code === 404 || type === "row_not_found" || type === "document_not_found"
  );
}

export interface RefundOrderInput {
  amount?: number;
  lines?: Array<{ orderItemId: string; quantity: number }>;
  orderId: string;
  reason?: string;
  restock?: boolean;
}

export type RefundActionResult =
  | { success: true; amount: number; refundedTotal: number; status: string }
  | { success: false; error: string };

/**
 * Orders are a commerce surface: campus admins own their campus's orders and
 * global admins own all of them, matching the orders tab's own gate. Department
 * product authors manage a catalog and never see order or refund data.
 *
 * Returns the campus ids the caller may act within, or `null` for unrestricted
 * (global admin).
 */
async function requireOrderAccess(): Promise<{
  campusIds: string[] | null;
  ctx: Awaited<ReturnType<typeof requireAuth>>;
}> {
  const ctx = await requireAuth();
  if (!canViewShopOperations(ctx.roles)) {
    throw new Error("Forbidden: shop operations access is required");
  }
  const unrestricted = ctx.roles.includes("globaladmin");
  return { campusIds: unrestricted ? null : ctx.managedCampusIds, ctx };
}

/**
 * A campus admin must not read or refund another campus's order. Orders are
 * campus-scoped only (no department column), mirroring `listOrders`.
 */
function isWithinScope(
  order: { campus_id?: string | null },
  campusIds: string[] | null
): boolean {
  if (campusIds === null) {
    return true;
  }
  // An order with no campus is national/unscoped; only a global admin, who is
  // already unrestricted above, should reach it.
  return Boolean(order.campus_id && campusIds.includes(order.campus_id));
}

/**
 * Loads one order with its lines, buyer answers and refund history.
 *
 * Campus scope is enforced in code (see the client note below), so an order
 * belonging to another campus reads as not-found.
 */
export async function getOrderDetail(
  orderId: string
): Promise<OrderDetail | null> {
  const { campusIds } = await requireOrderAccess();
  // Admin client, deliberately. The `orders` table grants reads only to the
  // Operations Unit team and each row additionally to its buyer, while campus
  // admins are derived from the campus-leadership teams — so a session read
  // 404s for exactly the role this surface authorizes. Authorization is
  // `requireOrderAccess` above plus the campus check below, both enforced in
  // code before any data is returned.
  const { db } = await createAdminClient();

  // Only a genuine "no such row" may become a 404. Anything else is rethrown:
  // swallowing it renders the not-found page for what is really a broken
  // query, which is exactly how a bad projection stayed invisible.
  const order = await db
    .getRow<RefundableOrder>("app", "orders", orderId, [
      ORDER_WITH_REFUNDS_SELECT,
    ])
    .catch((error: unknown) => {
      if (isRowNotFound(error)) {
        return null;
      }
      console.error(`[order-detail] Failed to read order ${orderId}:`, error);
      throw error;
    });

  if (!order) {
    return null;
  }
  if (!isWithinScope(order, campusIds)) {
    console.warn(
      `[order-detail] ${orderId} is outside the caller's campus scope (order campus: ${order.campus_id ?? "none"}).`
    );
    return null;
  }

  order.refunds = await loadOrderRefunds(orderId, db);

  const items = toRefundableItems(order);
  const summary = computeRefundable(
    {
      refundedTotal: Number(order.refunded_total ?? 0),
      total: Number(order.total ?? 0),
    },
    items,
    toRecordedRefunds(order)
  );

  return toOrderDetail({
    extras: toLineExtras(getOrderItems(order)),
    isMembership: isMembershipOrder(order),
    items,
    order,
    summary,
  });
}

/**
 * Builds the provider-side refund executor for an order. The reference differs
 * per provider: Vipps refunds against the ePayment reference (which is the
 * order id, stored as `payment_session_id`), Stripe against the PaymentIntent.
 */
async function buildExecutor(
  order: RefundableOrder,
  db: AdminDb
): Promise<{ executor: RefundExecutor } | { error: string }> {
  const provider = order.payment_provider;

  if (provider === "vipps") {
    const vipps = await resolveVippsCredentials(db);
    if (!vipps) {
      return { error: "Vipps is not configured" };
    }
    const reference = order.payment_session_id;
    if (!reference) {
      return { error: "This order has no Vipps payment to refund" };
    }
    const creds: RefundCredentials = { provider: "vipps", vipps };
    return {
      executor: {
        refund: (input) =>
          refundPayment({ ...input, provider: "vipps", reference }, creds),
      },
    };
  }

  if (provider === "stripe") {
    const stripe = await resolveStripeCredentials(db);
    if (!stripe) {
      return { error: "Stripe is not configured" };
    }
    // Stripe refunds address the PaymentIntent, not the Checkout Session. It is
    // written by the status transition, so an order that never settled has none
    // — and an unsettled order is not refundable anyway.
    const reference = order.payment_intent_id;
    if (!reference) {
      return { error: "This order has no settled Stripe payment to refund" };
    }
    const creds: RefundCredentials = { provider: "stripe", stripe };
    return {
      executor: {
        refund: (input) =>
          refundPayment({ ...input, provider: "stripe", reference }, creds),
      },
    };
  }

  return { error: "This order has no supported payment provider" };
}

const REFUND_ERRORS: Record<string, string> = {
  amount_exceeds_refundable:
    "That is more than the amount still refundable on this order.",
  amount_not_positive: "Enter an amount greater than zero.",
  claimed_elsewhere:
    "Another refund on this order is already in progress. Try again in a moment.",
  line_quantity_exceeds_refundable:
    "One of those lines has already been refunded.",
  not_found: "Order not found.",
  order_not_refundable:
    "Only a settled (paid) order can be refunded. An authorized reservation should be cancelled instead.",
  provider_failed: "The payment provider rejected the refund.",
};

/**
 * Issues a full or partial refund against an order.
 *
 * The money movement, locking and bookkeeping live in
 * `@repo/shared/utils/order-refunds`; this action is the authorization
 * boundary, the provider/ledger wiring, and the audit trail.
 */
export async function refundOrderAction(
  input: RefundOrderInput
): Promise<RefundActionResult> {
  try {
    const { campusIds, ctx } = await requireOrderAccess();
    const { db } = await createAdminClient();

    // Re-read with the admin client for the write path, but authorize against
    // the caller's campus scope first — the admin client bypasses row security.
    const order = await db
      .getRow<RefundableOrder>("app", "orders", input.orderId, [
        ORDER_WITH_REFUNDS_SELECT,
      ])
      .catch((error: unknown) => {
        if (isRowNotFound(error)) {
          return null;
        }
        throw error;
      });
    if (!order) {
      return { success: false, error: REFUND_ERRORS.not_found };
    }
    if (!isWithinScope(order, campusIds)) {
      return {
        success: false,
        error: "You do not have access to this campus's orders.",
      };
    }

    const built = await buildExecutor(order, db);
    if ("error" in built) {
      return { success: false, error: built.error };
    }

    const result = await refundOrder({
      actor: { id: ctx.userId, name: ctx.name ?? ctx.email },
      amount: input.amount,
      db,
      executor: built.executor,
      ledger: finagoRefundReverser,
      lines: input.lines,
      orderId: input.orderId,
      reason: input.reason,
      restock: input.restock,
    });

    if (!result.ok) {
      return {
        success: false,
        error:
          result.message && result.reason === "provider_failed"
            ? `${REFUND_ERRORS.provider_failed} ${result.message}`
            : (REFUND_ERRORS[result.reason] ?? "Failed to refund this order."),
      };
    }

    await logAuditEvent(ctx, "order.refund", {
      resourceId: input.orderId,
      resourceType: "orders",
      payload: {
        amount: result.amount,
        lines: input.lines?.length ?? 0,
        provider: order.payment_provider,
        reason: input.reason,
        refundId: result.refundId,
        restock: Boolean(input.restock),
      },
    });

    revalidatePath(`/shop/orders/${input.orderId}`);
    revalidatePath("/shop");

    return {
      success: true,
      amount: result.amount,
      refundedTotal: result.refundedTotal,
      status: result.status,
    };
  } catch (error) {
    console.error("[order-refunds] refund failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to refund this order.",
    };
  }
}
