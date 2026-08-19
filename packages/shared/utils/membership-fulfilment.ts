import type { Memberships, Orders, Users } from "@repo/api/types/appwrite";
import {
  assignMembershipCategory,
  MembershipCustomerLookupError,
  postMembershipInvoice,
  upsertMembershipCustomer,
} from "@repo/connectors/24sevenoffice";
import { sanitizeStudentNumber } from "./bi-student";
import { buildMembershipInvoiceOrder } from "./finago-membership-invoice";
import { type MembershipPlan, toMembershipPlan } from "./membership-plans";
import type { ParsedOrderItem } from "./order-parsing";
import { getOrderItems } from "./order-parsing";
import { ORDER_ITEMS_SELECT } from "./order-queries";
import type { DbClient } from "./vipps-order-ops";

// Everything the invoice builder + category assignment actually need from a
// plan, snapshotted onto the order item at checkout time (see
// `planSnapshotFromItem`) rather than re-read from the live `memberships`
// catalog at fulfilment time.
type PurchasedPlanSnapshot = Pick<
  MembershipPlan,
  | "accrualMonths"
  | "categoryId"
  | "duration"
  | "price"
  | "productId"
  | "startDate"
>;

// Pending an `appwrite push tables`; extend locally until the generated types
// are regenerated.
//
// `membership_invoice_id` now carries THREE possible meanings behind one
// truthy check, mirroring the equivalent overload of `finago_transaction_id`
// in finago-order-posting.ts:
//   1. a real 24SO invoice id (a membership order, fulfilled);
//   2. FULFILMENT_MARKER ("fulfilling"), the in-flight/manual-recovery marker
//      for a membership order (see `postToFinago`'s doc comment);
//   3. NON_MEMBERSHIP_SENTINEL ("not_membership"), stamped below onto a shop
//      order the reconcile-orders cron's membership-recovery sweep
//      encountered, so it drops out of that sweep's `IS NULL` query
//      permanently instead of re-entering it (and crowding out genuinely
//      unfulfilled membership orders) on every run for the rest of its
//      lifetime.
// Any future admin/reporting UI that reads this column as a real invoice id
// must special-case both sentinels.
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
    | "customer_lookup_failed"
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

export function isMembershipOrder(
  order: Parameters<typeof getOrderItems>[0]
): boolean {
  return getOrderItems(order).some(
    (item) => (item as { product_type?: string }).product_type === "membership"
  );
}

// Stamped into `membership_invoice_id` for a NON-membership (shop) order that
// the reconcile-orders cron's membership-recovery sweep encountered — the
// symmetric fix to MEMBERSHIP_LEDGER_EXCLUSION in finago-order-posting.ts,
// which solves the identical crowding failure mode on the Finago-posting
// sweep. See the `MembershipOrder` doc comment above for the full column
// contract. Deliberately not a value that could ever collide with a real 24SO
// invoice id (those are stringified numbers).
const NON_MEMBERSHIP_SENTINEL = "not_membership";

/**
 * Best-effort: stamps the non-membership sentinel onto a shop order's
 * `membership_invoice_id` so it permanently drops out of the reconcile
 * cron's membership-recovery sweep (`Query.isNull("membership_invoice_id")`).
 *
 * Without this, `membership_invoice_id` is only ever written for a
 * membership order — so every shop order ever paid matches that query
 * forever, and with no ordering clause a large-enough backlog of old paid
 * shop orders can consume the sweep's row budget every single run, starving
 * out genuinely unfulfilled membership orders.
 *
 * Call only for an order confirmed NOT to be a membership order
 * (`!isMembershipOrder(order)`) — never for anything that might legitimately
 * need fulfilling later. A failure here is logged and swallowed: worst case
 * the order is re-examined (and re-stamped) on the next sweep, which is
 * harmless.
 */
export async function stampNonMembershipOrder(
  orderId: string,
  db: DbClient
): Promise<void> {
  const { dbId, ordersId } = tables();
  await db
    .updateRow(dbId, ordersId, orderId, {
      membership_invoice_id: NON_MEMBERSHIP_SENTINEL,
    })
    .catch((error) => {
      console.error(
        `[Membership] Failed to stamp non-membership sentinel for order ${orderId}:`,
        error
      );
    });
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

/**
 * Undoes `prepareFulfilment`'s marker write and releases the claim — used
 * ONLY for a `MembershipCustomerLookupError`, i.e. the 24SO customer *search*
 * itself failed before anything was written to Finago. Unlike every other
 * failure inside `postToFinago`, this one is provably safe to retry
 * automatically: no create/category/invoice call was ever attempted. Clearing
 * the marker (not just the lock) matters — `fulfilMembershipOrder` short-
 * circuits on ANY truthy `membership_invoice_id`, and the reconcile cron's
 * sweep query is `IS NULL` on that same column, so leaving the marker in
 * place would strand the order even with the lock released.
 */
async function abortAfterLookupFailure(
  orderId: string,
  db: DbClient
): Promise<void> {
  const { dbId, ordersId } = tables();
  await db
    .updateRow(dbId, ordersId, orderId, { membership_invoice_id: null })
    .catch((error) => {
      console.error(
        `[Membership] Failed to clear the fulfilment marker for order ${orderId} after an aborted customer lookup:`,
        error
      );
    });
  await releaseClaim(orderId, db);
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

const ACCRUAL_MONTHS_OPTIONS = new Set([6, 12, 36]);
const PLAN_DURATIONS = new Set(["semester", "year", "three_years"]);

/**
 * Reconstructs the plan snapshotted onto the order item at checkout time
 * (see the membership-checkout route), instead of the live `memberships`
 * catalog. Returns `null` when the snapshot is missing or incomplete — either
 * an older order predating this snapshot, or corrupted `items_json` — so the
 * caller can fall back to a catalog read rather than fabricate a plan from
 * partial data.
 */
function planSnapshotFromItem(
  item: ParsedOrderItem
): PurchasedPlanSnapshot | null {
  const productId = Number.parseInt(String(item.membership_id ?? ""), 10);
  const categoryId = Number.parseInt(String(item.category_id ?? ""), 10);
  const price = Number(item.unit_price ?? item.price ?? Number.NaN);
  const accrualMonths = Number(item.accrual_months);
  const duration = item.duration;
  const startDate = item.start_date;

  if (
    !(
      Number.isFinite(productId) &&
      Number.isFinite(categoryId) &&
      Number.isFinite(price) &&
      price > 0 &&
      ACCRUAL_MONTHS_OPTIONS.has(accrualMonths)
    ) ||
    typeof duration !== "string" ||
    !PLAN_DURATIONS.has(duration) ||
    typeof startDate !== "string" ||
    !startDate
  ) {
    return null;
  }

  return {
    productId,
    categoryId,
    price,
    accrualMonths: accrualMonths as 6 | 12 | 36,
    duration: duration as MembershipPlan["duration"],
    startDate,
  };
}

/**
 * Resolves the membership plan and campus the order was purchased for.
 *
 * Prefers the plan snapshotted onto the order item at checkout — what the
 * student actually paid — over a fresh `memberships` catalog read. An
 * administrator can edit `memberships.price` (or zero/delete the row
 * entirely) between payment and fulfilment; the cron recovery path in
 * particular can run much later than the other two triggers. Booking
 * whatever the catalog says *today* would record revenue that doesn't match
 * what was collected, and a zeroed/deleted plan would make `toMembershipPlan`
 * return `null` forever, permanently stranding an already-charged order.
 * Falls back to the catalog read only for older orders that predate the
 * snapshot. `toMembershipPlan` returning `null` on that fallback path
 * (unparseable dates, non-sellable row) is treated as a hard stop, never a
 * default.
 */
async function resolvePurchasedPlan(
  order: MembershipOrder,
  db: DbClient
): Promise<{ campusId: string; plan: PurchasedPlanSnapshot } | null> {
  const { dbId } = tables();
  const item = getOrderItems(order).find(
    (candidate) =>
      (candidate as { product_type?: string }).product_type === "membership"
  );
  const campusId = order.campus_id;

  if (!(item && campusId)) {
    return null;
  }

  const snapshot = planSnapshotFromItem(item);
  if (snapshot) {
    return { campusId, plan: snapshot };
  }

  const planRow = (await db
    .getRow(dbId, "memberships", item.product_id ?? "")
    .catch(() => null)) as Memberships | null;
  const plan = planRow ? toMembershipPlan(planRow) : null;
  if (!plan) {
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
  plan: PurchasedPlanSnapshot,
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

type PostToFinagoResult =
  | { invoiceId: number; lookupFailed?: false }
  | { invoiceId: null; lookupFailed: boolean };

/**
 * Performs the Finago side effects — customer upsert, category assignment,
 * invoice post — and records the real invoice id.
 *
 * From here the marker stays put whatever happens, WITH ONE EXCEPTION: a
 * `MembershipCustomerLookupError` means the 24SO customer *search* itself
 * failed — nothing was written to Finago yet, so unlike every other failure
 * in this function it's safe (and, per the design, required) to undo the
 * marker and release the claim so the reconcile cron retries. Every other
 * failure may still have created the customer, category, or invoice
 * upstream, so the caller must NOT release the claim and must NOT clear the
 * marker for those — an automatic retry could double-invoice a student. This
 * is left for manual recovery.
 */
async function postToFinago(
  orderId: string,
  order: MembershipOrder,
  identity: { employeeId: number; studentNumber: number },
  plan: PurchasedPlanSnapshot,
  invoicePayload: ReturnType<typeof buildMembershipInvoiceOrder>,
  db: DbClient
): Promise<PostToFinagoResult> {
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
    return { invoiceId };
  } catch (error) {
    if (error instanceof MembershipCustomerLookupError) {
      console.error(
        `[Membership] Customer lookup failed for order ${orderId}; nothing was written to Finago, releasing the claim for retry:`,
        error
      );
      await abortAfterLookupFailure(orderId, db);
      return { invoiceId: null, lookupFailed: true };
    }
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
    return { invoiceId: null, lookupFailed: false };
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
    .getRow(dbId, ordersId, orderId, [ORDER_ITEMS_SELECT])
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

  const postResult = await postToFinago(
    orderId,
    order,
    identity,
    plan,
    invoicePayload,
    db
  );
  if (postResult.invoiceId === null) {
    return {
      fulfilled: false,
      reason: postResult.lookupFailed
        ? "customer_lookup_failed"
        : "finago_failed",
    };
  }

  return { fulfilled: true, invoiceId: postResult.invoiceId };
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
