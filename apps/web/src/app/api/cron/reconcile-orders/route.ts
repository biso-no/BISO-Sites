import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { reconcileVippsPayment } from "@repo/payment/vipps";
import {
  type FinagoOrder,
  postFinagoTransactionForOrder,
  releaseStaleFinagoClaim,
} from "@repo/shared/utils/finago-order-posting";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";
import { isProd } from "@/lib/utils";

/**
 * Order reconciliation sweep (PR-038). Driven on a schedule by the
 * `scheduled-dispatch` Appwrite Function (`ORDERS_RECONCILE_URL`), which POSTs
 * with an `x-cron-secret` header; can also be hit manually with
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Two passes per run:
 * 1. Payment reconcile — pending/authorized Vipps orders older than the grace
 *    window are re-fetched from Vipps (capture-if-authorized + idempotent
 *    status transition). Recovers orders whose webhook never landed and
 *    mobile buyers who never returned to the site.
 * 2. Finago recovery — paid/authorized orders with no `finago_transaction_id`
 *    get their ledger posting retried (stale posting claims are released
 *    first). The atomic claim inside postFinagoTransactionForOrder keeps this
 *    safe alongside the webhook and return-route triggers.
 *
 * Recommended schedule: every 10-15 minutes.
 */

const GRACE_MINUTES = 10;
const SWEEP_LIMIT = 50;

function isAuthorized(request: Request, cronSecret: string): boolean {
  const headerSecret = request.headers.get("x-cron-secret");
  if (safeSecretCompare(headerSecret, cronSecret)) {
    return true;
  }
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return safeSecretCompare(bearer, cronSecret);
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

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
      Query.limit(SWEEP_LIMIT),
    ]);

    for (const order of orders.rows) {
      if (order.payment_provider !== "vipps" || !order.payment_session_id) {
        continue;
      }
      try {
        await reconcileVippsPayment(order.$id, db);
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
  posted: number;
  released: number;
  errors: number;
}> {
  let posted = 0;
  let released = 0;
  let errors = 0;

  const orders = await db.listRows<FinagoOrder>("app", "orders", [
    Query.equal("status", ["paid", "authorized"]),
    Query.isNull("finago_transaction_id"),
    Query.lessThan("$createdAt", cutoffIso()),
    Query.limit(SWEEP_LIMIT),
  ]);

  for (const order of orders.rows) {
    try {
      if (await releaseStaleFinagoClaim(order, db)) {
        released += 1;
        // Lock was stale; retry on the next sweep rather than immediately, so
        // a still-running poster isn't raced.
        continue;
      }
      if ((order.finago_posting_lock ?? 0) > 0) {
        // A live (non-stale) claim is held by an active poster. Do not probe
        // it: calling postFinagoTransactionForOrder here would touch the row
        // and refresh $updatedAt every sweep, so a claim left behind by a
        // crashed poster could never age past STALE_CLAIM_MS and would strand
        // the paid order unposted. Wait for the holder to finish or for the
        // stale-claim sweep above to reclaim it.
        continue;
      }
      const result = await postFinagoTransactionForOrder(order.$id, db);
      if (result.posted) {
        posted += 1;
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

  return { posted, released, errors };
}

async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (isProd && !cronSecret) {
    console.error("CRON_SECRET is not configured in production");
    return NextResponse.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (cronSecret && !isAuthorized(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { db } = await createAdminClient();
    const reconcile = await sweepUnsettledOrders(db);
    const finago = await sweepMissingFinagoPostings(db);

    return NextResponse.json(
      {
        success: true,
        reconciled: reconcile.reconciled,
        finagoPosted: finago.posted,
        staleClaimsReleased: finago.released,
        errors: reconcile.errors + finago.errors,
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
