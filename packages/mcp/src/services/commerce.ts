/**
 * Orders.
 *
 * Reads only. The refund path is deliberately absent: `refundPayment` in
 * `@repo/payment` carries an explicit warning that the Vipps SDK mints a fresh
 * idempotency key per request, so a retried refund refunds twice, and the guard
 * against that is an atomic `refund_lock` held by the orchestrator in
 * `@repo/shared/utils/order-refunds`. Re-implementing that lock here would mean
 * two independent implementations of the same invariant against real money.
 * Refunds stay in the admin app; this module explains order and refund state so
 * a human can act in the right place.
 *
 * Scope mirrors `buildAssistantOrderSearchQueries`: campus-scoped, no
 * department dimension. Note `orders` grants table-level read only to
 * Operations Unit, so a campus admin's own credential may return nothing even
 * where the scope filter would allow it — the result says which of the two
 * applied.
 */

import { Query } from "@repo/api";
import type { Orders } from "@repo/api/types/appwrite";
import { getOrderItems } from "@repo/shared/utils/order-parsing";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import type { BackendClients } from "../appwrite/clients";
import { campusLabel } from "../identity/campus";
import type { Principal } from "../identity/principal";
import { canReadRow, describeScope, scopeQueries } from "../identity/scope";
import { DomainError, fromAppwriteError, notFound } from "../runtime/errors";

export const ORDER_STATUSES = [
  "pending",
  "authorized",
  "paid",
  "cancelled",
  "failed",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderSummary {
  buyerEmail: string | null;
  buyerName: string | null;
  campusId: string | null;
  campusLabel: string;
  createdAt: string;
  currency: string;
  id: string;
  paymentProvider: string | null;
  /** True when the order has been posted to the Finago ledger. */
  postedToLedger: boolean;
  refundedTotal: number | null;
  status: string | null;
  total: number;
}

export interface OrderDetail extends OrderSummary {
  /**
   * What is blocking or has completed downstream of payment, in plain terms.
   * Derived from stored state only — no provider is contacted.
   */
  diagnostics: string[];
  items: Array<{
    name: string | null;
    quantity: number | null;
    unitPrice: number | null;
    lineTotal: number | null;
    productType: string | null;
  }>;
  refundedAt: string | null;
}

export interface CommerceService {
  getOrder(principal: Principal, orderId: string): Promise<OrderDetail>;
  searchOrders(
    principal: Principal,
    input: {
      query?: string;
      status?: OrderStatus;
      limit: number;
      offset: number;
    }
  ): Promise<{ rows: OrderSummary[]; total: number }>;
}

/** `getOrderItems` returns loosely-typed parsed JSON; narrow before use. */
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toSummary(order: Orders): OrderSummary {
  return {
    id: order.$id,
    status: order.status ?? null,
    buyerName: order.buyer_name ?? null,
    buyerEmail: order.buyer_email ?? null,
    campusId: order.campus_id ?? null,
    campusLabel: campusLabel(order.campus_id),
    currency: order.currency ?? "NOK",
    total: order.total,
    refundedTotal: order.refunded_total ?? null,
    paymentProvider: order.payment_provider ?? null,
    createdAt: order.$createdAt,
    postedToLedger: Boolean(order.finago_transaction_id),
  };
}

/**
 * Explain where an order stands, from stored columns alone.
 *
 * Deliberately not a provider call: saying "Vipps reports X" would require
 * contacting Vipps, and this module does not.
 */
function diagnose(order: Orders): string[] {
  const notes: string[] = [];
  if (order.status === "pending") {
    notes.push(
      "Payment has not completed. The order stays pending until the provider confirms or the reconcile sweep resolves it."
    );
  }
  if (order.status === "authorized") {
    notes.push(
      "Funds are authorized but not captured. Capture happens on settlement."
    );
  }
  if (order.status === "paid" && !order.finago_transaction_id) {
    notes.push(
      "Paid but not yet posted to the Finago ledger. Posting is gated by the `shop_ledger_posting` feature flag, which is off by default; paid orders wait until it is turned on."
    );
  }
  if (order.finago_posting_lock && order.finago_posting_lock > 0) {
    notes.push(
      `A ledger-posting claim is held (finago_posting_lock=${order.finago_posting_lock}). A stale claim is released by the reconcile sweep.`
    );
  }
  if (order.refund_lock && order.refund_lock > 0) {
    notes.push(
      `A refund claim is held (refund_lock=${order.refund_lock}). This is the guard that stops a retried refund from refunding twice.`
    );
  }
  if (
    order.refunded_total &&
    order.refunded_total > 0 &&
    order.refunded_total < order.total
  ) {
    notes.push(
      `Partially refunded: ${order.refunded_total} of ${order.total} ${order.currency ?? "NOK"}.`
    );
  }
  if (order.membership_invoice_id) {
    notes.push(
      `A membership invoice was raised (${order.membership_invoice_id}). Membership orders are excluded from ordinary shop ledger posting.`
    );
  }
  return notes;
}

export function createCommerceService(
  clients: BackendClients
): CommerceService {
  return {
    async searchOrders(principal, input) {
      const queries: string[] = [
        Query.orderDesc("$createdAt"),
        // `orders` has no department column; a department-only principal fails
        // closed here, matching the portal where orders are a commerce surface
        // reserved for campus and global admins.
        ...scopeQueries(principal, { departmentField: null }),
      ];
      if (input.status) {
        queries.push(Query.equal("status", input.status));
      }
      const term = input.query?.trim();
      if (term) {
        queries.push(
          Query.or([
            Query.contains("buyer_name", term),
            Query.contains("buyer_email", term),
            Query.equal("$id", term),
          ])
        );
      }
      queries.push(Query.limit(input.limit), Query.offset(input.offset));

      try {
        const result = await clients.user.db.listRows<Orders>(
          "app",
          "orders",
          queries
        );
        return { rows: result.rows.map(toSummary), total: result.total };
      } catch (error) {
        throw fromAppwriteError(error, { operation: "search orders" });
      }
    },

    async getOrder(principal, orderId) {
      try {
        const order = await clients.user.db.getRow<Orders>(
          "app",
          "orders",
          orderId,
          [ORDER_ITEMS_SELECT]
        );
        // The `orders` table grants read to the whole Operations Unit team, so
        // Appwrite answering this call proves nothing about campus scope: a
        // department member of that team can fetch any campus's order by id
        // while `searchOrders` correctly shows them none. Re-apply the same
        // scope `searchOrders` applies — `departmentField: null`, so a
        // department-only principal fails closed exactly as it does there.
        //
        // Reported as `not_found` rather than `forbidden` on purpose: an order
        // id is guessable, and "forbidden" would confirm that it exists.
        if (!canReadRow(principal, order.campus_id, null)) {
          throw notFound(`No order ${orderId} is visible to you.`, {
            orderId,
            yourScope: describeScope(principal),
          });
        }
        return {
          ...toSummary(order),
          items: getOrderItems(order).map((item) => ({
            name: asString(item.name),
            quantity: asNumber(item.quantity),
            unitPrice: asNumber(item.unit_price),
            lineTotal: asNumber(item.line_total),
            productType: asString(item.product_type),
          })),
          refundedAt: order.refunded_at ?? null,
          diagnostics: diagnose(order),
        };
      } catch (error) {
        if (error instanceof DomainError) {
          throw error;
        }
        const mapped = fromAppwriteError(error, { operation: "get order" });
        if (mapped.code === "forbidden" || mapped.code === "not_found") {
          throw notFound(
            `No order ${orderId} is visible to you. The orders table grants read to the Operations Unit team; campus admins may not be able to read it directly.`,
            { orderId }
          );
        }
        throw mapped;
      }
    },
  };
}
