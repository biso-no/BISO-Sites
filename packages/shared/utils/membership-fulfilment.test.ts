import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertMembershipCustomer = vi.hoisted(() => vi.fn());
const assignMembershipCategory = vi.hoisted(() => vi.fn());
const postMembershipInvoice = vi.hoisted(() => vi.fn());
// Defined once and shared between the mock factory and the tests below, so
// `error instanceof MembershipCustomerLookupError` inside the module under
// test (which imports this same mocked binding) actually matches.
const MembershipCustomerLookupError = vi.hoisted(
  () => class MembershipCustomerLookupError extends Error {}
);

vi.mock("@repo/connectors/24sevenoffice", () => ({
  assignMembershipCategory,
  MembershipCustomerLookupError,
  postMembershipInvoice,
  upsertMembershipCustomer,
}));

import {
  fulfilMembershipOrder,
  isMembershipOrder,
} from "./membership-fulfilment";

const db = {
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  decrementRowColumn: vi.fn(),
};

const MEMBERSHIP_ITEMS = JSON.stringify([
  {
    product_id: "71",
    product_type: "membership",
    membership_id: "71",
    quantity: 1,
    unit_price: 550,
  },
]);

// Carries the full checkout-time snapshot (category_id/duration/
// accrual_months/start_date on top of the fields MEMBERSHIP_ITEMS already
// has) — this is what a membership-checkout-route order actually persists.
const SNAPSHOTTED_MEMBERSHIP_ITEMS = JSON.stringify([
  {
    product_id: "71",
    product_type: "membership",
    membership_id: "71",
    category_id: "113178",
    duration: "year",
    accrual_months: 12,
    start_date: "2026-08-01",
    quantity: 1,
    price: 550,
    unit_price: 550,
  },
]);

function paidMembershipOrder(overrides: Record<string, unknown> = {}) {
  return {
    $id: "order-1",
    $updatedAt: new Date().toISOString(),
    status: "paid",
    total: 550,
    campus_id: "2",
    userId: "user-1",
    buyer_email: "student@example.com",
    buyer_name: "Ola Nordmann",
    items_json: MEMBERSHIP_ITEMS,
    membership_invoice_id: null,
    membership_fulfilment_lock: 0,
    ...overrides,
  };
}

const profile = {
  $id: "user-1",
  student_id: "s1715738",
  bi_employee_id: "9001234",
};

const planRow = {
  $id: "71",
  name: "BISO Membership fall 2026 and spring 2027",
  membership_id: "71",
  category: "113178",
  price: 550,
  status: true,
  canPurchase: true,
  startDate: "2026-08-01",
  expiryDate: "2027-06-30",
};

function wireReads(order: Record<string, unknown>) {
  db.getRow.mockImplementation((_dbId: string, table: string, id: string) => {
    if (table === "orders") {
      return Promise.resolve(order);
    }
    if (table === "user") {
      return Promise.resolve(profile);
    }
    if (table === "memberships") {
      return Promise.resolve(planRow);
    }
    return Promise.reject(new Error(`unexpected read ${table}/${id}`));
  });
}

describe("isMembershipOrder", () => {
  it("detects the membership marker", () => {
    expect(isMembershipOrder({ items_json: MEMBERSHIP_ITEMS })).toBe(true);
  });

  it("rejects a normal shop order", () => {
    expect(
      isMembershipOrder({
        items_json: JSON.stringify([{ product_id: "x", quantity: 1 }]),
      })
    ).toBe(false);
  });

  it("rejects an empty order", () => {
    expect(isMembershipOrder({ items_json: null })).toBe(false);
  });
});

describe("fulfilMembershipOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.incrementRowColumn.mockResolvedValue({ membership_fulfilment_lock: 1 });
    db.decrementRowColumn.mockResolvedValue({ membership_fulfilment_lock: 0 });
    db.updateRow.mockResolvedValue({});
    // Deliberately different from profile.bi_employee_id ("9001234"):
    // upsertMembershipCustomer resolves-or-creates and can legitimately
    // return a different 24SO company id for an existing customer record. If
    // postToFinago regressed to using identity.employeeId instead of this
    // resolved id, the assertions below on assignMembershipCategory /
    // postMembershipInvoice would fail.
    upsertMembershipCustomer.mockResolvedValue(5_550_001);
    assignMembershipCategory.mockResolvedValue(undefined);
    postMembershipInvoice.mockResolvedValue(556_677);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates the customer, assigns the category, and invoices", async () => {
    wireReads(paidMembershipOrder());

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({ fulfilled: true, invoiceId: 556_677 });
    expect(upsertMembershipCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 9_001_234,
        studentNumber: 1_715_738,
      })
    );
    expect(assignMembershipCategory).toHaveBeenCalledWith(5_550_001, 113_178);
    expect(postMembershipInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        CustomerId: 5_550_001,
        DepartmentId: 300,
        AccrualLength: 12,
      })
    );
    expect(db.updateRow).toHaveBeenLastCalledWith(
      expect.any(String),
      "orders",
      "order-1",
      { membership_invoice_id: "556677" }
    );
  });

  it("skips an order that is not a membership", async () => {
    wireReads(
      paidMembershipOrder({
        items_json: JSON.stringify([{ product_id: "x", quantity: 1 }]),
      })
    );
    const result = await fulfilMembershipOrder("order-1", db);
    expect(result).toEqual({ fulfilled: false, reason: "not_membership" });
    expect(postMembershipInvoice).not.toHaveBeenCalled();
  });

  it("skips an unpaid order", async () => {
    wireReads(paidMembershipOrder({ status: "pending" }));
    const result = await fulfilMembershipOrder("order-1", db);
    expect(result).toEqual({ fulfilled: false, reason: "not_paid" });
    expect(postMembershipInvoice).not.toHaveBeenCalled();
  });

  it("skips an order that already has an invoice", async () => {
    wireReads(paidMembershipOrder({ membership_invoice_id: "556677" }));
    const result = await fulfilMembershipOrder("order-1", db);
    expect(result).toEqual({ fulfilled: false, reason: "already_fulfilled" });
    expect(postMembershipInvoice).not.toHaveBeenCalled();
  });

  it("stands down when another caller holds the claim", async () => {
    wireReads(paidMembershipOrder());
    db.incrementRowColumn.mockResolvedValue({ membership_fulfilment_lock: 2 });

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({ fulfilled: false, reason: "claimed_elsewhere" });
    expect(postMembershipInvoice).not.toHaveBeenCalled();
    expect(db.decrementRowColumn).toHaveBeenCalled();
  });

  it("refuses when the buyer has no employee id", async () => {
    db.getRow.mockImplementation((_dbId: string, table: string) => {
      if (table === "orders") {
        return Promise.resolve(paidMembershipOrder());
      }
      if (table === "user") {
        return Promise.resolve({ ...profile, bi_employee_id: null });
      }
      return Promise.resolve(planRow);
    });

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({ fulfilled: false, reason: "missing_identity" });
    expect(postMembershipInvoice).not.toHaveBeenCalled();
    // Claim released: this failed before any Finago side effect.
    expect(db.decrementRowColumn).toHaveBeenCalled();
  });

  it("keeps the marker and does not release when Finago already ran", async () => {
    wireReads(paidMembershipOrder());
    postMembershipInvoice.mockRejectedValue(new Error("timeout"));

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({ fulfilled: false, reason: "finago_failed" });
    // The invoice may exist upstream; never auto-retry.
    expect(db.decrementRowColumn).not.toHaveBeenCalled();
  });

  it("books the invoice from the checkout-time snapshot, not a since-changed catalog price (I1)", async () => {
    // The administrator raised the catalog price AFTER this order was paid —
    // wireReads' planRow (price 550) must never be consulted when a full
    // snapshot is present on the order item.
    wireReads(
      paidMembershipOrder({ items_json: SNAPSHOTTED_MEMBERSHIP_ITEMS })
    );

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({ fulfilled: true, invoiceId: 556_677 });
    expect(postMembershipInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        PaymentAmount: 550,
        AccrualDate: "2026-08-01",
        AccrualLength: 12,
        InvoiceRows: {
          InvoiceRow: expect.objectContaining({ Price: 550, ProductId: 71 }),
        },
      })
    );
    expect(assignMembershipCategory).toHaveBeenCalledWith(5_550_001, 113_178);
    // The catalog read is skipped entirely when the snapshot is usable —
    // "memberships" must never appear among the tables read.
    const tablesRead = db.getRow.mock.calls.map((call: unknown[]) => call[1]);
    expect(tablesRead).not.toContain("memberships");
  });

  it("falls back to the catalog price for an older order that predates the snapshot (I1)", async () => {
    // MEMBERSHIP_ITEMS (no category_id/duration/accrual_months/start_date)
    // represents an order placed before this snapshot existed.
    wireReads(paidMembershipOrder());

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({ fulfilled: true, invoiceId: 556_677 });
    // planRow's price/dates (from wireReads) are what get booked.
    expect(postMembershipInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ PaymentAmount: 550, AccrualLength: 12 })
    );
    const tablesRead = db.getRow.mock.calls.map((call: unknown[]) => call[1]);
    expect(tablesRead).toContain("memberships");
  });

  it("releases the claim and clears the marker when the Finago customer LOOKUP fails, instead of falling through to an overwrite-risking create (I5)", async () => {
    wireReads(paidMembershipOrder());
    upsertMembershipCustomer.mockRejectedValue(
      new MembershipCustomerLookupError("24SO search timed out")
    );

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({
      fulfilled: false,
      reason: "customer_lookup_failed",
    });
    expect(assignMembershipCategory).not.toHaveBeenCalled();
    expect(postMembershipInvoice).not.toHaveBeenCalled();
    // Unlike a generic post-marker Finago failure, a pure lookup failure
    // never touched Finago — safe (and required) to release for retry.
    expect(db.decrementRowColumn).toHaveBeenCalled();
    // The marker itself must be cleared too, not just the lock: leaving
    // FULFILMENT_MARKER in `membership_invoice_id` would still trip
    // `fulfilMembershipOrder`'s own already-fulfilled guard AND keep the
    // cron sweep's `IS NULL` query from ever matching this row again —
    // stranding it even with the lock released.
    expect(db.updateRow).toHaveBeenCalledWith(
      expect.any(String),
      "orders",
      "order-1",
      { membership_invoice_id: null }
    );
  });
});
