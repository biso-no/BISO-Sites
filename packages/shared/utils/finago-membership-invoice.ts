/**
 * Builds the 24SevenOffice `InvoiceOrder` payload for a membership purchase.
 *
 * Mirrors the payload the production membership tool (biso-no/funksjon) posts,
 * which is what BI's own student app produces, with two deliberate
 * differences:
 *   - OrderStatus is "Invoiced", not "Draft": the student has already paid by
 *     Vipps or Stripe, so there is nothing left for finance to collect.
 *   - AccrualDate comes from the plan's parsed semester start instead of a
 *     hardcoded date, so it does not rot at the next rollover.
 */

import {
  MEMBERSHIP_DIMENSION_IDS,
  MEMBERSHIP_DIMENSION_LABELS,
  type MembershipPlan,
  membershipAccrualStart,
} from "./membership-plans";

export const CAMPUS_INVOICE_DEPARTMENT_IDS: Record<string, number> = {
  "1": 1, // Oslo
  "2": 300, // Bergen
  "3": 600, // Trondheim
  "4": 800, // Stavanger
  "5": 1000, // National
};

export const CAMPUS_INVOICE_NAMES: Record<string, string> = {
  "1": "Oslo",
  "2": "Bergen",
  "3": "Trondheim",
  "4": "Stavanger",
  "5": "National",
};

export interface UserDefinedDimension {
  Name: string;
  Type: "UserDefined";
  TypeId: string;
  Value: string;
}

export interface MembershipInvoiceRow {
  DepartmentId: number;
  Price: number;
  ProductId: number;
  Quantity: number;
  UserDefinedDimensions: { UserDefinedDimension: UserDefinedDimension[] };
}

export interface MembershipInvoiceOrder {
  AccrualDate: string;
  AccrualLength: number;
  Addresses: {
    Delivery: { Country: string };
    Invoice: { Country: string };
  };
  CustomerId: number;
  DateInvoiced: string;
  DepartmentId: number;
  Distributor: string;
  InvoiceRows: { InvoiceRow: MembershipInvoiceRow };
  OrderStatus: "Invoiced";
  PaymentAmount: number;
  PaymentMethodId: number;
  PaymentTime: number;
  UserDefinedDimensions: { UserDefinedDimension: UserDefinedDimension[] };
}

export interface BuildMembershipInvoiceParams {
  campusId: string;
  customerId: number;
  invoicedOn: string;
  // Only these five fields are read below — callers may pass either a full
  // `MembershipPlan` (the live catalog) or a narrower snapshot reconstructed
  // from what was actually charged at checkout (see
  // `membership-fulfilment.ts`'s `PurchasedPlanSnapshot`), which is what the
  // invoice should book from whenever it's available.
  plan: Pick<
    MembershipPlan,
    "accrualMonths" | "duration" | "price" | "productId" | "startDate"
  >;
  /**
   * When the order was placed (`orders.$createdAt`). The accrual period is a
   * function of this, not of when fulfilment happens to run.
   */
  purchasedOn?: string;
}

/**
 * The accrual start to book this invoice into.
 *
 * A membership accrues from the half-year boundary containing the **purchase**:
 * bought in the summer half it accrues from 1 July, in the spring half from
 * 1 January.
 *
 * `purchasedOn` is the order row's own `$createdAt` — the moment checkout wrote
 * the order, which is the same instant it snapshotted `start_date`. Deriving
 * from it is therefore identical to reading the snapshot for every order
 * written since that change, and correct for every order written before it,
 * without having to guess which kind an order is.
 *
 * **Why not infer provenance from the snapshot's value.** An earlier version
 * accepted the snapshot when it was its own accrual start (`membershipAccrual-
 * Start` is idempotent) and otherwise fell back to the invoice date. Both
 * halves were unsound, and PR review caught it:
 *
 *   - A *legacy* catalogue date that happens to be a half-year boundary —
 *     `2026-07-01` — passes the idempotence check and is indistinguishable from
 *     a real snapshot, so an order bought in 2028 could book into July 2026.
 *   - The fallback used `invoicedOn`, which fulfilment supplies as *today*. A
 *     retry or the reconcile cron crossing 1 January or 1 July then booked the
 *     wrong accounting period for an order bought before it.
 *
 * The recorded purchase timestamp removes both: it is what the accrual is
 * defined in terms of, so nothing has to be inferred. `snapshot` is still read
 * as a fallback for a caller with no order timestamp, and `invoicedOn` behind
 * that, so this can never return nothing where it previously returned a date.
 */
function accrualDateFor(
  snapshot: string,
  invoicedOn: string,
  purchasedOn?: string
): string {
  const fromPurchase = purchasedOn ? membershipAccrualStart(purchasedOn) : null;
  if (fromPurchase) {
    return fromPurchase;
  }
  const fromSnapshot = membershipAccrualStart(snapshot);
  if (fromSnapshot && fromSnapshot === snapshot) {
    return fromSnapshot;
  }
  const fromInvoice = membershipAccrualStart(invoicedOn);
  if (!fromInvoice) {
    throw new Error(
      `Cannot determine an accrual start from invoicedOn "${invoicedOn}"`
    );
  }
  return fromInvoice;
}

function buildDimensions(
  campusId: string,
  plan: Pick<MembershipPlan, "duration">
): UserDefinedDimension[] {
  // `Object.hasOwn` guards against prototype-chain lookups (e.g. campusId ===
  // "constructor" or "toString" resolving to an inherited Object.prototype
  // member instead of `undefined`), which a plain `=== undefined` check on a
  // bracket access would miss.
  if (!Object.hasOwn(CAMPUS_INVOICE_NAMES, campusId)) {
    throw new Error(`Unknown campus id: ${campusId}`);
  }
  const campusName = CAMPUS_INVOICE_NAMES[campusId];

  return [
    {
      Type: "UserDefined",
      Name: campusName,
      Value: campusId,
      TypeId: "101",
    },
    {
      Type: "UserDefined",
      Name: MEMBERSHIP_DIMENSION_IDS[plan.duration],
      Value: MEMBERSHIP_DIMENSION_LABELS[plan.duration],
      TypeId: "102",
    },
  ];
}

export function buildMembershipInvoiceOrder({
  campusId,
  customerId,
  invoicedOn,
  purchasedOn,
  plan,
}: BuildMembershipInvoiceParams): MembershipInvoiceOrder {
  // `Object.hasOwn` guards against prototype-chain lookups (e.g. campusId ===
  // "constructor" or "toString" resolving to an inherited Object.prototype
  // member instead of `undefined`), which a plain `=== undefined` check on a
  // bracket access would miss.
  if (!Object.hasOwn(CAMPUS_INVOICE_DEPARTMENT_IDS, campusId)) {
    throw new Error(`Unknown campus id: ${campusId}`);
  }
  const departmentId = CAMPUS_INVOICE_DEPARTMENT_IDS[campusId];

  const dimensions = buildDimensions(campusId, plan);

  return {
    CustomerId: customerId,
    OrderStatus: "Invoiced",
    PaymentMethodId: 1,
    PaymentTime: 0,
    Distributor: "Manual",
    DateInvoiced: invoicedOn,
    PaymentAmount: plan.price,
    DepartmentId: departmentId,
    Addresses: {
      Delivery: { Country: "NO" },
      Invoice: { Country: "NO" },
    },
    InvoiceRows: {
      InvoiceRow: {
        ProductId: plan.productId,
        Price: plan.price,
        Quantity: 1,
        DepartmentId: departmentId,
        UserDefinedDimensions: { UserDefinedDimension: dimensions },
      },
    },
    AccrualDate: accrualDateFor(plan.startDate, invoicedOn, purchasedOn),
    AccrualLength: plan.accrualMonths,
    UserDefinedDimensions: { UserDefinedDimension: dimensions },
  };
}
