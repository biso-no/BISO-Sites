import type { Memberships, Orders, Users } from "@repo/api/types/appwrite";
import {
  assignMembershipCategory,
  postMembershipInvoice,
  upsertMembershipCustomer,
} from "@repo/connectors/24sevenoffice";
import { sanitizeStudentNumber } from "./bi-student";
import { buildMembershipInvoiceOrder } from "./finago-membership-invoice";
import { type MembershipPlan, toMembershipPlan } from "./membership-plans";
import { parseOrderItems } from "./order-parsing";
import type { DbClient } from "./vipps-order-ops";

// Pending an `appwrite push tables`; extend locally until the generated types
// are regenerated.
export type MembershipOrder = Orders & {
  membership_fulfilment_lock?: number | null;
  membership_invoice_id?: string | null;
};

type BiUser = Users & { bi_employee_id?: string | null };

export interface MembershipFulfilmentResult {
  fulfilled: boolean;
  invoiceId?: number;
  reason?:
    | "already_fulfilled"
    | "claimed_elsewhere"
    | "not_found"
    | "not_membership"
    | "not_paid"
    | "missing_identity"
    | "plan_unavailable"
    | "finago_failed";
}

const FULFILLABLE_STATUSES = new Set(["authorized", "paid"]);

// Written before the first Finago call and overwritten with the real invoice
// id on success. While set, no automatic path may fulfil this order again — a
// retry after a partial failure could double-invoice a student.
const FULFILMENT_MARKER = "fulfilling";
const WHITESPACE_RE = /\s+/;

function tables() {
  return {
    dbId: process.env.APPWRITE_DATABASE_ID ?? "app",
    ordersId: process.env.APPWRITE_ORDERS_COLLECTION_ID ?? "orders",
  };
}

export function isMembershipOrder(order: {
  items_json?: string | null;
}): boolean {
  return parseOrderItems(order.items_json ?? null).some(
    (item) => (item as { product_type?: string }).product_type === "membership"
  );
}

async function releaseClaim(orderId: string, db: DbClient): Promise<void> {
  const { dbId, ordersId } = tables();
  if (!db.decrementRowColumn) {
    return;
  }
  await db
    .decrementRowColumn({
      databaseId: dbId,
      tableId: ordersId,
      rowId: orderId,
      column: "membership_fulfilment_lock",
      value: 1,
      min: 0,
    })
    .catch(() => {
      // The stale-claim sweep recovers the lock.
    });
}

function splitName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(WHITESPACE_RE).filter(Boolean);
  return {
    firstName: parts[0] ?? "Student",
    lastName: parts.slice(1).join(" ") || "Member",
  };
}

/**
 * Atomically claims the fulfilment lock via `incrementRowColumn`. Returns
 * `false` when another caller already holds it — in which case this caller
 * has already released its own increment (see the comment below) and must
 * stand down rather than proceed.
 */
async function claimFulfilmentLock(
  orderId: string,
  db: DbClient
): Promise<boolean> {
  if (!db.incrementRowColumn) {
    return true;
  }

  const { dbId, ordersId } = tables();
  try {
    const claimed = await db.incrementRowColumn<Record<string, unknown>>({
      databaseId: dbId,
      tableId: ordersId,
      rowId: orderId,
      column: "membership_fulfilment_lock",
      value: 1,
    });
    const lockValue =
      typeof claimed?.membership_fulfilment_lock === "number"
        ? claimed.membership_fulfilment_lock
        : 0;
    if (lockValue !== 1) {
      // Lost the race. Undo our own increment so the lock reflects only the
      // in-flight winner (0/1) instead of drifting upward with every loser —
      // an inflated lock combined with each attempt refreshing $updatedAt
      // would keep releaseStaleMembershipClaim from ever aging out a
      // crashed claim, stranding the paid order unfulfilled.
      await releaseClaim(orderId, db);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      `[Membership] Atomic claim failed for order ${orderId}; proceeding best-effort:`,
      error
    );
    return true;
  }
}

/**
 * Resolves the BI identity (student number + Azure employee id) backing the
 * order's buyer. Both are required: the employee id is the Finago customer
 * number and the student number is its `ExternalId`.
 */
async function resolveBuyerIdentity(
  order: MembershipOrder,
  db: DbClient
): Promise<{ employeeId: number; studentNumber: number } | null> {
  const { dbId } = tables();
  const profile = (await db
    .getRow(dbId, "user", order.userId ?? "")
    .catch(() => null)) as BiUser | null;
  const studentNumber = sanitizeStudentNumber(profile?.student_id);
  const employeeId = sanitizeStudentNumber(profile?.bi_employee_id);

  if (studentNumber === null || employeeId === null) {
    return null;
  }
  return { employeeId, studentNumber };
}

/**
 * Resolves the membership plan and campus the order was purchased for.
 * `toMembershipPlan` returning `null` (unparseable dates, non-sellable row)
 * is treated as a hard stop, never a default.
 */
async function resolvePurchasedPlan(
  order: MembershipOrder,
  db: DbClient
): Promise<{ campusId: string; plan: MembershipPlan } | null> {
  const { dbId } = tables();
  const item = parseOrderItems(order.items_json ?? null).find(
    (candidate) =>
      (candidate as { product_type?: string }).product_type === "membership"
  ) as { product_id?: string } | undefined;

  const planRow = (await db
    .getRow(dbId, "memberships", item?.product_id ?? "")
    .catch(() => null)) as Memberships | null;
  const plan = planRow ? toMembershipPlan(planRow) : null;
  const campusId = order.campus_id;

  if (!(plan && campusId)) {
    return null;
  }
  return { campusId, plan };
}

/**
 * Builds the Finago invoice payload and writes the in-flight marker. This is
 * the last step before any Finago call: a failure here (payload build or the
 * marker write itself) happens before the external side effect, so it is
 * safe to release the claim on failure and let a later sweep retry.
 */
async function prepareFulfilment(
  orderId: string,
  employeeId: number,
  campusId: string,
  plan: MembershipPlan,
  db: DbClient
): Promise<ReturnType<typeof buildMembershipInvoiceOrder> | null> {
  const { dbId, ordersId } = tables();
  try {
    const invoicePayload = buildMembershipInvoiceOrder({
      campusId,
      customerId: employeeId,
      plan,
      invoicedOn: new Date().toISOString().slice(0, 10),
    });
    await db.updateRow(dbId, ordersId, orderId, {
      membership_invoice_id: FULFILMENT_MARKER,
    });
    return invoicePayload;
  } catch (error) {
    await releaseClaim(orderId, db);
    console.error(
      `[Membership] Failed to prepare fulfilment for order ${orderId}:`,
      error
    );
    return null;
  }
}

/**
 * Performs the Finago side effects — customer upsert, category assignment,
 * invoice post — and records the real invoice id. From here the marker stays
 * put whatever happens: a failure may still have created the customer,
 * category, or invoice upstream. The caller must NOT release the claim and
 * must NOT clear the marker on failure — an automatic retry could
 * double-invoice a student. This is left for manual recovery.
 */
async function postToFinago(
  orderId: string,
  order: MembershipOrder,
  identity: { employeeId: number; studentNumber: number },
  plan: MembershipPlan,
  invoicePayload: ReturnType<typeof buildMembershipInvoiceOrder>,
  db: DbClient
): Promise<number | null> {
  const { dbId, ordersId } = tables();
  // Tracks whether postMembershipInvoice already succeeded, so the catch
  // below can tell "nothing landed in Finago yet" apart from "the invoice
  // exists in Finago but recording its id here failed" — the latter is the
  // worst case (a real invoice with no local breadcrumb) and needs the
  // invoice id in the log for manual reconciliation.
  let invoiceId: number | undefined;
  try {
    const { firstName, lastName } = splitName(order.buyer_name);
    const customerId = await upsertMembershipCustomer({
      employeeId: identity.employeeId,
      studentNumber: identity.studentNumber,
      firstName,
      lastName,
      email: order.buyer_email ?? undefined,
    });

    await assignMembershipCategory(customerId, plan.categoryId);

    invoiceId = await postMembershipInvoice({
      ...invoicePayload,
      CustomerId: customerId,
    });

    await db.updateRow(dbId, ordersId, orderId, {
      membership_invoice_id: String(invoiceId),
    });

    console.log(
      `[Membership] Fulfilled order ${orderId} as invoice ${invoiceId} for customer ${customerId}`
    );
    return invoiceId;
  } catch (error) {
    if (invoiceId === undefined) {
      console.error(
        `[Membership] Fulfilment attempted for order ${orderId}; leaving marker for manual recovery:`,
        error
      );
    } else {
      console.error(
        `[Membership] Order ${orderId} was invoiced in Finago as ${invoiceId} but recording it failed; reconcile manually.`,
        error
      );
    }
    return null;
  }
}

/**
 * Registers a paid membership purchase in Finago exactly once: customer,
 * category, invoice.
 *
 * Called from the payment webhook, the browser return route, and the
 * reconciliation cron — whichever sees the paid order first wins the atomic
 * claim and the others stand down.
 */
export async function fulfilMembershipOrder(
  orderId: string,
  db: DbClient
): Promise<MembershipFulfilmentResult> {
  const { dbId, ordersId } = tables();

  const order = (await db
    .getRow(dbId, ordersId, orderId)
    .catch(() => null)) as MembershipOrder | null;
  if (!order) {
    return { fulfilled: false, reason: "not_found" };
  }
  if (!isMembershipOrder(order)) {
    return { fulfilled: false, reason: "not_membership" };
  }
  if (!FULFILLABLE_STATUSES.has(order.status ?? "")) {
    return { fulfilled: false, reason: "not_paid" };
  }
  if (order.membership_invoice_id) {
    return { fulfilled: false, reason: "already_fulfilled" };
  }

  const claimed = await claimFulfilmentLock(orderId, db);
  if (!claimed) {
    return { fulfilled: false, reason: "claimed_elsewhere" };
  }

  // Everything below, up to the marker write in prepareFulfilment, happens
  // before any Finago side effect — so a failure releases the claim for a
  // later retry.
  const identity = await resolveBuyerIdentity(order, db);
  if (!identity) {
    await releaseClaim(orderId, db);
    console.error(
      `[Membership] Order ${orderId} has no usable BI identity; manual follow-up required.`
    );
    return { fulfilled: false, reason: "missing_identity" };
  }

  const purchase = await resolvePurchasedPlan(order, db);
  if (!purchase) {
    await releaseClaim(orderId, db);
    console.error(
      `[Membership] Order ${orderId} references an unavailable plan or campus.`
    );
    return { fulfilled: false, reason: "plan_unavailable" };
  }
  const { campusId, plan } = purchase;

  const invoicePayload = await prepareFulfilment(
    orderId,
    identity.employeeId,
    campusId,
    plan,
    db
  );
  if (!invoicePayload) {
    return { fulfilled: false, reason: "finago_failed" };
  }

  const invoiceId = await postToFinago(
    orderId,
    order,
    identity,
    plan,
    invoicePayload,
    db
  );
  if (invoiceId === null) {
    return { fulfilled: false, reason: "finago_failed" };
  }

  return { fulfilled: true, invoiceId };
}

const STALE_CLAIM_MS = 30 * 60 * 1000;

/**
 * Recovers a claim taken but never completed (process died between claim and
 * marker). Reconciliation sweep only.
 */
export async function releaseStaleMembershipClaim(
  order: MembershipOrder,
  db: DbClient,
  now: number = Date.now()
): Promise<boolean> {
  const lockValue = order.membership_fulfilment_lock ?? 0;
  if (lockValue <= 0 || order.membership_invoice_id) {
    return false;
  }

  const updatedAt = Date.parse(order.$updatedAt);
  if (Number.isNaN(updatedAt) || now - updatedAt < STALE_CLAIM_MS) {
    return false;
  }

  const { dbId, ordersId } = tables();
  console.warn(
    `[Membership] Releasing stale fulfilment claim on order ${order.$id} (lock: ${lockValue})`
  );
  await db.updateRow(dbId, ordersId, order.$id, {
    membership_fulfilment_lock: 0,
  });
  return true;
}
