/**
 * Provider-agnostic order reconciliation.
 *
 * Re-fetches the authoritative payment from whichever provider owns the order
 * and applies the resulting status transition. Idempotent and safe to call from
 * any entry point, in any order: the webhook/callback, the post-payment return
 * route, the reconciliation cron, and the buyer-facing verify action.
 *
 * Before this existed only Vipps had a reconcile path, so the cron sweep
 * skipped Stripe orders entirely — a Stripe order whose webhook never landed
 * and whose buyer closed the tab before the redirect stayed PENDING forever:
 * stock never decremented, revenue never posted, membership never fulfilled.
 */

import { orNullIfNotFound } from "@repo/api/errors";
import { finagoRefundReverser } from "@repo/shared/utils/finago-refund-reverser";
import {
  type LedgerReverser,
  listPendingRefunds,
  loadOrderRefunds,
  ORDER_WITH_REFUNDS_SELECT,
  type RefundableOrder,
  settlePendingRefund,
} from "@repo/shared/utils/order-refunds";
import { determineStatusFromStripeSession } from "@repo/shared/utils/stripe-pure";
import {
  applyOrderStatusTransition,
  type DbClient,
} from "@repo/shared/utils/vipps-order-ops";
import { resolveStripeCredentials } from "./credentials";
import type { PaymentSettingsReader } from "./credentials/types";
import {
  getStripeReceiptUrl,
  getStripeRefundedTotal,
  getStripeRefundState,
  getStripeSession,
  hasStripePaymentFailed,
} from "./stripe";
import { reconcileVippsPayment } from "./vipps";

type ReconcileDb = DbClient & PaymentSettingsReader;

interface ReconcilableOrder {
  payment_intent_id?: string | null;
  payment_provider?: string | null;
  payment_receipt_url?: string | null;
  payment_session_id?: string | null;
}

function ordersTable(): { collId: string; dbId: string } {
  return {
    dbId: process.env.APPWRITE_DATABASE_ID ?? "app",
    collId: process.env.APPWRITE_ORDERS_COLLECTION_ID ?? "orders",
  };
}

/**
 * Reconciles a Stripe order from its Checkout Session. The session carries the
 * PaymentIntent id, which the transition persists; the hosted receipt URL is
 * fetched separately and stored on the first settled pass so the admin and
 * buyer receipt links resolve.
 */
async function reconcileStripePayment(
  orderId: string,
  order: ReconcilableOrder,
  db: ReconcileDb
): Promise<void> {
  const sessionId = order.payment_session_id;
  if (!sessionId) {
    return;
  }

  const creds = await resolveStripeCredentials(db);
  if (!creds) {
    return;
  }

  const { session } = await getStripeSession(sessionId, creds);

  // A delayed-notification payment that FAILED leaves the session
  // `complete`/`unpaid`, which is indistinguishable from one still settling.
  // Only the `async_payment_failed` event carries that signal, so if it was
  // missed this sweep would keep the order PENDING forever. Ask the
  // PaymentIntent, which is authoritative, and feed the mapper the event type
  // it would have received.
  const intentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  let eventType: string | undefined;
  if (
    intentId &&
    session.status === "complete" &&
    session.payment_status === "unpaid" &&
    (await hasStripePaymentFailed(intentId, creds).catch(() => false))
  ) {
    eventType = "checkout.session.async_payment_failed";
  }

  const { status, updateData } = determineStatusFromStripeSession(
    session,
    eventType
  );

  // Fetch the receipt once, while we already know the intent id, and only when
  // the order does not have one yet — a settled payment's receipt never
  // changes, so re-fetching it on every sweep is wasted API calls.
  const receiptIntentId =
    (typeof updateData.payment_intent_id === "string"
      ? updateData.payment_intent_id
      : null) ?? order.payment_intent_id;
  if (receiptIntentId && !order.payment_receipt_url) {
    const receiptUrl = await getStripeReceiptUrl(receiptIntentId, creds).catch(
      () => null
    );
    if (receiptUrl) {
      updateData.payment_receipt_url = receiptUrl;
    }
  }

  await applyOrderStatusTransition(orderId, status, updateData, db);
}

/**
 * Reconciles one order against its payment provider. A no-op for orders with
 * no provider session yet, or an unrecognised provider.
 */
export async function reconcileOrderPayment(
  orderId: string,
  db: ReconcileDb
): Promise<void> {
  const { dbId, collId } = ordersTable();
  // Only a 404 is a quiet no-op. Any other read failure throws, so the cron
  // counts it as an error instead of reporting the order as reconciled.
  const order = (await orNullIfNotFound(
    db.getRow<ReconcilableOrder>(dbId, collId, orderId)
  )) as ReconcilableOrder | null;

  if (!order?.payment_session_id) {
    return;
  }

  if (order.payment_provider === "vipps") {
    // Vipps owns its own reconcile: it also captures an authorized-but-
    // uncaptured payment before applying the transition.
    await reconcileVippsPayment(orderId, db);
    return;
  }

  if (order.payment_provider === "stripe") {
    await reconcileStripePayment(orderId, order, db);
  }
}

export interface PendingRefundSweepTally {
  /**
   * Refunds that could not be processed because a read or write failed
   * (Appwrite outage, timeout, 401). They stay pending and are retried, but
   * the sweep must report them as failures rather than as merely unresolved.
   */
  errors: number;
  failed: number;
  settled: number;
  unresolved: number;
}

/**
 * Resolves refunds left in `pending` — accepted-but-unsettled Stripe refunds,
 * and attempts whose outcome was never confirmed.
 *
 * This is the completion path a pending row depends on. Without it, such a row
 * holds its share of the refundable balance forever and a refund that later
 * succeeds never restores stock or reverses the ledger. Vipps refunds settle
 * synchronously, so only Stripe attempts carry a resolvable provider id;
 * anything else is left for a human, which is the safe direction.
 */
export async function sweepPendingRefunds(
  db: ReconcileDb,
  olderThanIso: string,
  // Defaulted, not optional-and-forgotten: finalizing without a reverser marks
  // the refund succeeded and restocks it while the original Finago posting is
  // never reversed, and nothing revisits succeeded refunds to repair that.
  ledger: LedgerReverser = finagoRefundReverser
): Promise<PendingRefundSweepTally> {
  const tally: PendingRefundSweepTally = {
    errors: 0,
    failed: 0,
    settled: 0,
    unresolved: 0,
  };
  const pending = await listPendingRefunds(db, olderThanIso);
  if (pending.length === 0) {
    return tally;
  }

  const creds = await resolveStripeCredentials(db);
  const { collId: ordersId, dbId } = ordersTable();

  for (const refund of pending) {
    const orderId =
      typeof refund.order === "string" ? refund.order : refund.order?.$id;
    if (!orderId) {
      tally.unresolved += 1;
      continue;
    }

    let order: RefundableOrder | null;
    try {
      order = (await orNullIfNotFound(
        db.getRow<RefundableOrder>(dbId, ordersId, orderId, [
          ORDER_WITH_REFUNDS_SELECT,
        ])
      )) as RefundableOrder | null;
    } catch (error) {
      console.error(
        `[Refund] Could not read order ${orderId}; leaving refund ${refund.$id} pending:`,
        error
      );
      tally.errors += 1;
      continue;
    }
    if (!order) {
      tally.unresolved += 1;
      continue;
    }
    // Deliberately unguarded. An empty history makes the ledger allocation
    // weight against every original line instead of only the unreversed ones,
    // and settlement would still advance — baking a wrong revenue-account
    // reversal in permanently. Leaving the attempt pending is recoverable.
    try {
      order.refunds = await loadOrderRefunds(orderId, db);
    } catch (error) {
      console.error(
        `[Refund] Could not load refund history for ${orderId}; leaving refund ${refund.$id} pending:`,
        error
      );
      tally.errors += 1;
      continue;
    }

    // Per-refund guard. `finalizeSettledRefund` deliberately throws when the
    // status flip fails, and settling also posts to Finago — without this one
    // bad row aborts the whole sweep AND the cron steps that run after it.
    let outcome: Awaited<ReturnType<typeof settlePendingRefund>>;
    try {
      outcome = await settlePendingRefund({
        db,
        ledger,
        order,
        refund,
        resolver: {
          state: async ({ paymentIntentId, providerRefundId }) => {
            if (!(creds && providerRefundId)) {
              // No provider handle to ask — a Vipps attempt, or one that never
              // got far enough to record an id. Throwing keeps it pending
              // rather than guessing that it failed.
              throw new Error("No resolvable provider refund id");
            }
            const state = await getStripeRefundState(providerRefundId, creds);
            // Carry Stripe's own aggregate through: it is the only figure that
            // includes refunds issued straight from the dashboard, and
            // reporting zero here would overstate the refundable balance.
            const refundedTotalMinor = paymentIntentId
              ? await getStripeRefundedTotal(paymentIntentId, creds).catch(
                  () => 0
                )
              : 0;
            return { ...state, refundedTotalMinor };
          },
        },
      });
    } catch (error) {
      console.error(
        `[Refund] Sweep could not settle refund ${refund.$id}:`,
        error
      );
      tally.errors += 1;
      continue;
    }

    if (outcome === "settled") {
      tally.settled += 1;
    } else if (outcome === "failed") {
      tally.failed += 1;
    } else if (outcome === "unresolved") {
      tally.unresolved += 1;
    }
  }

  return tally;
}
