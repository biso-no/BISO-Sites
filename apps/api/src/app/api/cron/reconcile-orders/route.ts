import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  reconcileOrderPayment,
  sweepPendingRefunds,
} from "@repo/payment/reconcile";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import {
  type FinagoOrder,
  postFinagoTransactionForOrder,
  releaseStaleFinagoClaim,
} from "@repo/shared/utils/finago-order-posting";
import {
  fulfilMembershipOrder,
  isMembershipOrder,
  type MembershipOrder,
  releaseStaleMembershipClaim,
  stampNonMembershipOrder,
} from "@repo/shared/utils/membership-fulfilment";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";

/**
 * Order reconciliation sweep. Driven by the `scheduled-dispatch` Appwrite
 * Function (`ORDERS_RECONCILE_URL`), which sends `x-cron-secret`; can also be
 * hit manually with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Passes per run:
 * 1. Payment reconcile — pending/authorized orders older than the grace window
 *    are re-fetched from their provider and put through the idempotent status
 *    transition. The only recovery path that depends on neither the buyer nor
 *    webhook delivery, so it must cover both providers — when it was
 *    Vipps-only, a Stripe order with a missed webhook stayed pending forever.
 * 2. Finago recovery — paid/authorized shop orders with no
 *    `finago_transaction_id` get their ledger posting retried (stale posting
 *    claims are released first).
 * 3. Refund resolution — refunds still `pending` past the grace window are
 *    resolved against the provider.
 * 4. Membership recovery — paid/authorized membership orders with no
 *    `membership_invoice_id` get fulfilment retried.
 *
 * Recommended schedule: every 5–15 minutes.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const GRACE_MINUTES = 10;
const SWEEP_LIMIT = 50;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

function readBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function hasValidCronSecret(request: Request, secret: string): boolean {
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
  ];
  return candidates.some((candidate) => safeSecretCompare(candidate, secret));
}

function cutoffIso(): string {
  return new Date(Date.now() - GRACE_MINUTES * 60 * 1000).toISOString();
}

async function sweepUnsettledOrders(db: AdminDb): Promise<{
  reconciled: number;
  errors: number;
}> {
  let reconciled = 0;
  let errors = 0;

  for (const status of ["pending", "authorized"]) {
    const orders = await db.listRows<FinagoOrder>("app", "orders", [
      Query.equal("status", status),
      Query.lessThan("$createdAt", cutoffIso()),
      ORDER_ITEMS_SELECT,
      Query.limit(SWEEP_LIMIT),
    ]);

    for (const order of orders.rows) {
      if (!order.payment_session_id) {
        continue;
      }
      try {
        await reconcileOrderPayment(order.$id, db);
        reconciled += 1;
      } catch (error) {
        errors += 1;
        console.error(
          `[Reconcile Orders] Failed to reconcile order ${order.$id}:`,
          error
        );
      }
    }
  }

  return { reconciled, errors };
}

async function sweepMissingFinagoPostings(db: AdminDb): Promise<{
  errors: number;
  notConfigured: number;
  posted: number;
  released: number;
}> {
  let posted = 0;
  let released = 0;
  let notConfigured = 0;
  let errors = 0;

  const orders = await db.listRows<FinagoOrder>("app", "orders", [
    Query.equal("status", ["paid", "authorized"]),
    Query.isNull("finago_transaction_id"),
    Query.lessThan("$createdAt", cutoffIso()),
    // Least recently touched first. Every attempt claims and releases
    // `finago_posting_lock`, which refreshes $updatedAt, so an order blocked on
    // a config gap rotates to the back instead of holding the head of the list
    // and starving newer postable orders.
    Query.orderAsc("$updatedAt"),
    ORDER_ITEMS_SELECT,
    Query.limit(SWEEP_LIMIT),
  ]);

  for (const order of orders.rows) {
    try {
      if (await releaseStaleFinagoClaim(order, db)) {
        released += 1;
        // Retry on the next sweep rather than immediately, so a still-running
        // poster isn't raced.
        continue;
      }
      if ((order.finago_posting_lock ?? 0) > 0) {
        // A live claim is held by an active poster. Probing it would refresh
        // $updatedAt every sweep, so a crashed claim could never age out.
        continue;
      }
      const result = await postFinagoTransactionForOrder(order.$id, db);
      if (result.posted) {
        posted += 1;
      } else if (result.reason === "not_configured") {
        notConfigured += 1;
      } else if (result.reason === "post_failed") {
        errors += 1;
      }
    } catch (error) {
      errors += 1;
      console.error(
        `[Reconcile Orders] Finago recovery failed for order ${order.$id}:`,
        error
      );
    }
  }

  return { errors, notConfigured, posted, released };
}

async function recoverMembershipFulfilment(db: AdminDb): Promise<{
  fulfilled: number;
  released: number;
  errors: number;
}> {
  let fulfilled = 0;
  let released = 0;
  let errors = 0;

  const orders = await db.listRows<MembershipOrder>("app", "orders", [
    Query.equal("status", ["paid", "authorized"]),
    Query.isNull("membership_invoice_id"),
    Query.lessThan("$createdAt", cutoffIso()),
    ORDER_ITEMS_SELECT,
    Query.limit(SWEEP_LIMIT),
  ]);

  for (const order of orders.rows) {
    if (!isMembershipOrder(order)) {
      // An unstamped shop order matches this sweep's `IS NULL` query forever;
      // stamp it out so it cannot crowd genuine membership orders.
      await stampNonMembershipOrder(order.$id, db);
      continue;
    }
    try {
      if (await releaseStaleMembershipClaim(order, db)) {
        released += 1;
        continue;
      }
      if ((order.membership_fulfilment_lock ?? 0) > 0) {
        // A live claim is held by an active fulfiller. Probing it would
        // refresh $updatedAt every sweep, so a crashed claim could never age
        // out.
        continue;
      }
      const result = await fulfilMembershipOrder(order.$id, db);
      if (result.fulfilled) {
        fulfilled += 1;
      } else if (result.reason === "finago_failed") {
        errors += 1;
      }
    } catch (error) {
      errors += 1;
      console.error(
        `[Reconcile Orders] Membership recovery failed for order ${order.$id}:`,
        error
      );
    }
  }

  return { fulfilled, released, errors };
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { db } = await createAdminClient();
    const reconcile = await sweepUnsettledOrders(db);
    // While posting is switched off, paid orders simply wait; reading them
    // every run would only spend the sweep's row budget.
    const finago = (await isFeatureEnabled("shop_ledger_posting"))
      ? await sweepMissingFinagoPostings(db)
      : null;
    const refunds = await sweepPendingRefunds(db, cutoffIso());
    const membership = await recoverMembershipFulfilment(db);

    return NextResponse.json(
      {
        success: true,
        reconciled: reconcile.reconciled,
        finagoPosted: finago?.posted ?? 0,
        finagoNotConfigured: finago?.notConfigured ?? 0,
        finagoSkipped: finago === null,
        staleClaimsReleased: finago?.released ?? 0,
        membershipFulfilled: membership.fulfilled,
        membershipClaimsReleased: membership.released,
        refundsSettled: refunds.settled,
        refundsFailed: refunds.failed,
        refundsUnresolved: refunds.unresolved,
        errors: reconcile.errors + (finago?.errors ?? 0) + membership.errors,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error in reconcile-orders cron:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reconcile orders" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
