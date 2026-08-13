export enum Currency {
  NOK = "NOK",
}

export interface CheckoutSessionParams {
  campusId?: string;
  currency: Currency;
  customerInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    streetAddress?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  discountTotal?: number;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    title?: string; // Add optional fields that might be used
    unit_price?: number;
    product_type?: string;
    category?: string;
    // Non-price fulfillment metadata carried through to the persisted order so
    // receipts/fulfillment retain the buyer's variant and custom-field answers.
    variationId?: string;
    variationName?: string;
    customFields?: Record<string, string>;
    customFieldLabels?: Record<string, string>;
    // Membership-purchase-only snapshot of the plan as purchased. Fulfilment
    // (`resolvePurchasedPlan` in membership-fulfilment.ts) prefers this over
    // a fresh `memberships` catalog read, since an administrator can edit or
    // remove the catalog row between payment and fulfilment — the invoice
    // must book what the student actually paid, not today's catalog. Falls
    // back to a catalog read only when this snapshot is absent (orders that
    // predate it). `price`/`unit_price` above double as the snapshotted
    // price; `start_date` is the plan's parsed accrual start.
    membership_id?: string;
    category_id?: string;
    duration?: string;
    accrual_months?: number;
    start_date?: string;
  }>;
  memberDiscountPercent?: number;
  membershipApplied?: boolean;
  reference: string;
  shippingCost?: number;
  subtotal: number;
  total: number;
  userId: string;
}

/** The five terminal/non-terminal payment states the ePayment API reports. */
export type VippsState =
  | "CREATED"
  | "AUTHORIZED"
  | "ABORTED"
  | "EXPIRED"
  | "TERMINATED";

/** A monetary amount in minor units (øre for NOK). */
export interface VippsAmount {
  currency?: string;
  value: number;
}

/**
 * Aggregate amounts the ePayment API tracks for a payment. A payment never
 * changes `state` after `AUTHORIZED`; capture/cancel/refund are reflected here
 * (not in `state`), so status is derived from these totals.
 */
export interface VippsAggregate {
  authorizedAmount?: VippsAmount;
  cancelledAmount?: VippsAmount;
  capturedAmount?: VippsAmount;
  refundedAmount?: VippsAmount;
}

/** Normalized view of an ePayment payment used across the order pipeline. */
export interface VippsPaymentSnapshot {
  aggregate?: VippsAggregate;
  /** Vipps PSP reference for the payment — stored as `payment_intent_id`. */
  pspReference?: string;
  state: VippsState;
}
