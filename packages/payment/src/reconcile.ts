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

import { determineStatusFromStripeSession } from "@repo/shared/utils/stripe-pure";
import {
  applyOrderStatusTransition,
  type DbClient,
} from "@repo/shared/utils/vipps-order-ops";
import { resolveStripeCredentials } from "./credentials";
import type { PaymentSettingsReader } from "./credentials/types";
import { getStripeReceiptUrl, getStripeSession } from "./stripe";
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
  const { status, updateData } = determineStatusFromStripeSession(session);

  // Fetch the receipt once, while we already know the intent id, and only when
  // the order does not have one yet — a settled payment's receipt never
  // changes, so re-fetching it on every sweep is wasted API calls.
  const intentId =
    (typeof updateData.payment_intent_id === "string"
      ? updateData.payment_intent_id
      : null) ?? order.payment_intent_id;
  if (intentId && !order.payment_receipt_url) {
    const receiptUrl = await getStripeReceiptUrl(intentId, creds).catch(
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
  const order = (await db
    .getRow<ReconcilableOrder>(dbId, collId, orderId)
    .catch(() => null)) as ReconcilableOrder | null;

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
