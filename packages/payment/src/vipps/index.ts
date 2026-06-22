import type {
  VippsAmount,
  VippsPaymentSnapshot,
} from "@repo/shared/types/vipps";
import {
  applyOrderStatusTransition,
  type DbClient,
} from "@repo/shared/utils/vipps-order-ops";
import { determineStatusFromPaymentState } from "@repo/shared/utils/vipps-pure";
import { resolveVippsCredentials } from "../credentials";
import type {
  PaymentSettingsReader,
  VippsCredentials,
} from "../credentials/types";
import { buildVippsClient, getVippsAccessToken } from "./client";
import type { CheckoutSessionParams } from "./types";
import { VIPPS_WEBHOOK_EVENTS } from "./webhook";

export {
  parseVippsWebhookEvent,
  verifyVippsWebhookSignature,
  VIPPS_WEBHOOK_EVENTS,
  type VippsWebhookEvent,
  type VippsWebhookEventName,
} from "./webhook";

const MINOR_UNITS_PER_MAJOR = 100;

/** ISO-4217 codes the ePayment API accepts. */
type VippsCurrency = "NOK" | "DKK" | "EUR";

function toMinorUnits(amount: number): number {
  return Math.round(amount * MINOR_UNITS_PER_MAJOR);
}

function toVippsCurrency(currency: string): VippsCurrency {
  return String(currency) as VippsCurrency;
}

/** Shape returned by `payment.info`/`payment.capture`/etc. that we normalize. */
interface VippsPaymentData {
  aggregate?: {
    authorizedAmount?: VippsAmount;
    cancelledAmount?: VippsAmount;
    capturedAmount?: VippsAmount;
    refundedAmount?: VippsAmount;
  };
  pspReference?: string;
  state: VippsPaymentSnapshot["state"];
}

function toSnapshot(data: VippsPaymentData): VippsPaymentSnapshot {
  return {
    state: data.state,
    pspReference: data.pspReference,
    aggregate: {
      authorizedAmount: data.aggregate?.authorizedAmount,
      capturedAmount: data.aggregate?.capturedAmount,
      cancelledAmount: data.aggregate?.cancelledAmount,
      refundedAmount: data.aggregate?.refundedAmount,
    },
  };
}

/** Redirect target after the user finishes the payment in Vipps. */
export interface VippsPaymentUrls {
  /** Post-payment redirect — the `apps/web` checkout return route. */
  returnUrl: string;
}

/**
 * Creates an ePayment payment and returns the hosted redirect URL.
 *
 * The `reference` is the internal order id, which makes it deterministic and
 * unique per checkout attempt — webhooks and status lookups resolve the order
 * straight from it. The returned `redirectUrl` must be opened unmodified.
 */
export async function createVippsPayment(
  params: CheckoutSessionParams & { orderId: string },
  creds: VippsCredentials,
  urls: VippsPaymentUrls
): Promise<{ checkoutUrl: string; reference: string }> {
  const client = buildVippsClient(creds);
  const token = await getVippsAccessToken(creds);
  const reference = params.orderId;

  const result = await client.payment.create(token, {
    amount: {
      currency: toVippsCurrency(params.currency),
      value: toMinorUnits(params.total),
    },
    paymentMethod: { type: "WALLET" },
    reference,
    returnUrl: urls.returnUrl,
    userFlow: "WEB_REDIRECT",
    paymentDescription: `Order ${params.orderId}`,
  });

  if (!result.ok) {
    throw new Error(`Vipps payment creation failed: ${JSON.stringify(result)}`);
  }

  const redirectUrl = result.data.redirectUrl;
  if (!redirectUrl) {
    throw new Error("Vipps payment creation returned no redirectUrl");
  }

  return { checkoutUrl: redirectUrl, reference };
}

/** Fetches the authoritative payment snapshot from Vipps. No DB operations. */
export async function getVippsPayment(
  reference: string,
  creds: VippsCredentials
): Promise<VippsPaymentSnapshot> {
  const client = buildVippsClient(creds);
  const token = await getVippsAccessToken(creds);
  const result = await client.payment.info(token, reference);

  if (!result.ok) {
    throw new Error(`Failed to get Vipps payment: ${JSON.stringify(result)}`);
  }
  return toSnapshot(result.data);
}

/** Captures (the given amount of) an authorized payment. Returns the new snapshot. */
export async function captureVippsPayment(
  reference: string,
  amount: { currency: string; value: number },
  creds: VippsCredentials
): Promise<VippsPaymentSnapshot> {
  const client = buildVippsClient(creds);
  const token = await getVippsAccessToken(creds);
  const result = await client.payment.capture(token, reference, {
    modificationAmount: {
      currency: toVippsCurrency(amount.currency),
      value: amount.value,
    },
  });

  if (!result.ok) {
    throw new Error(`Vipps capture failed: ${JSON.stringify(result)}`);
  }
  return toSnapshot(result.data);
}

/** Cancels the remaining (uncaptured) reservation on a payment. */
export async function cancelVippsPayment(
  reference: string,
  creds: VippsCredentials
): Promise<VippsPaymentSnapshot> {
  const client = buildVippsClient(creds);
  const token = await getVippsAccessToken(creds);
  const result = await client.payment.cancel(token, reference);

  if (!result.ok) {
    throw new Error(`Vipps cancel failed: ${JSON.stringify(result)}`);
  }
  return toSnapshot(result.data);
}

/** Refunds (the given amount of) a captured payment. */
export async function refundVippsPayment(
  reference: string,
  amount: { currency: string; value: number },
  creds: VippsCredentials
): Promise<VippsPaymentSnapshot> {
  const client = buildVippsClient(creds);
  const token = await getVippsAccessToken(creds);
  const result = await client.payment.refund(token, reference, {
    modificationAmount: {
      currency: toVippsCurrency(amount.currency),
      value: amount.value,
    },
  });

  if (!result.ok) {
    throw new Error(`Vipps refund failed: ${JSON.stringify(result)}`);
  }
  return toSnapshot(result.data);
}

/**
 * Registers a webhook for the sales unit and returns the signing secret. The
 * caller is responsible for persisting the secret (used to verify subsequent
 * webhook deliveries).
 */
export async function registerVippsWebhook(
  url: string,
  creds: VippsCredentials
): Promise<{ id: string; secret: string }> {
  const client = buildVippsClient(creds);
  const token = await getVippsAccessToken(creds);
  const result = await client.webhook.register(token, {
    url,
    events: [...VIPPS_WEBHOOK_EVENTS],
  });

  if (!result.ok) {
    throw new Error(
      `Vipps webhook registration failed: ${JSON.stringify(result)}`
    );
  }
  return { id: result.data.id, secret: result.data.secret };
}

/** Admin `db` client able to read settings, read the order, and write the transition. */
type ReconcileDb = DbClient & PaymentSettingsReader;

/** The order fields the reconcile path reads. */
interface ReconcileOrder {
  currency?: string | null;
  payment_provider?: string | null;
  payment_session_id?: string | null;
  status?: string | null;
  total?: number | null;
}

function ordersTable(): { collId: string; dbId: string } {
  return {
    dbId: process.env.APPWRITE_DATABASE_ID ?? "app",
    collId: process.env.APPWRITE_ORDERS_COLLECTION_ID ?? "orders",
  };
}

function amountValue(amount?: VippsAmount): number {
  return typeof amount?.value === "number" ? amount.value : 0;
}

function shouldCapture(
  order: ReconcileOrder,
  snapshot: VippsPaymentSnapshot
): boolean {
  return (
    snapshot.state === "AUTHORIZED" &&
    amountValue(snapshot.aggregate?.capturedAmount) === 0 &&
    order.status !== "paid" &&
    order.status !== "refunded"
  );
}

/**
 * Captures the full authorized amount after validating it against the order
 * total. Race-safe: if a concurrent webhook/return already captured, the retry
 * error is swallowed once the re-fetched snapshot shows captured funds.
 */
async function captureAuthorizedPayment(
  order: ReconcileOrder,
  reference: string,
  snapshot: VippsPaymentSnapshot,
  creds: VippsCredentials
): Promise<VippsPaymentSnapshot> {
  const expected = Math.round(
    (typeof order.total === "number" ? order.total : 0) * MINOR_UNITS_PER_MAJOR
  );
  const authorized = snapshot.aggregate?.authorizedAmount;
  const currency = authorized?.currency ?? order.currency ?? "NOK";

  if (!authorized || authorized.value !== expected) {
    console.error(
      `[vipps/reconcile] capture skipped for ${reference}: authorized ${authorized?.value ?? "?"} != expected ${expected}`
    );
    return snapshot;
  }

  try {
    return await captureVippsPayment(
      reference,
      { currency, value: authorized.value },
      creds
    );
  } catch (error) {
    const latest = await getVippsPayment(reference, creds);
    if (amountValue(latest.aggregate?.capturedAmount) > 0) {
      return latest;
    }
    throw error;
  }
}

/**
 * Idempotent reconcile shared by the webhook and the post-payment return route:
 * fetch the authoritative payment, immediately capture an authorized-but-
 * uncaptured payment, then apply the resulting status through the shared
 * transition helper (which owns stock/reservation handling). Safe to call
 * repeatedly and from either path in any order.
 */
export async function reconcileVippsPayment(
  orderId: string,
  db: ReconcileDb
): Promise<void> {
  const { dbId, collId } = ordersTable();
  const order = await db.getRow<ReconcileOrder>(dbId, collId, orderId);
  if (
    !order ||
    order.payment_provider !== "vipps" ||
    !order.payment_session_id
  ) {
    return;
  }

  const creds = await resolveVippsCredentials(db);
  if (!creds) {
    return;
  }

  const reference = order.payment_session_id;
  let snapshot = await getVippsPayment(reference, creds);

  if (shouldCapture(order, snapshot)) {
    snapshot = await captureAuthorizedPayment(order, reference, snapshot, creds);
  }

  const { status, updateData } = determineStatusFromPaymentState(snapshot);
  await applyOrderStatusTransition(orderId, status, updateData, db);
}
