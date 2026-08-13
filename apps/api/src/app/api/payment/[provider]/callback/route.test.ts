import { createAdminClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  applyOrderStatusTransition: vi.fn(),
  determineStatusFromStripeSession: vi.fn(),
  fulfilMembershipOrder: vi.fn(),
  isMembershipOrder: vi.fn(),
  parseVippsWebhookEvent: vi.fn(),
  postFinagoTransactionForOrder: vi.fn(),
  reconcileVippsPayment: vi.fn(),
  resolveStripeCredentials: vi.fn(),
  resolveVippsCredentials: vi.fn(),
  verifyStripeWebhook: vi.fn(),
  verifyVippsWebhookSignature: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@repo/payment/credentials", () => ({
  resolveStripeCredentials: mocks.resolveStripeCredentials,
  resolveVippsCredentials: mocks.resolveVippsCredentials,
}));
vi.mock("@repo/payment/stripe", () => ({
  verifyStripeWebhook: mocks.verifyStripeWebhook,
}));
vi.mock("@repo/payment/vipps", () => ({
  parseVippsWebhookEvent: mocks.parseVippsWebhookEvent,
  reconcileVippsPayment: mocks.reconcileVippsPayment,
  verifyVippsWebhookSignature: mocks.verifyVippsWebhookSignature,
}));
vi.mock("@repo/shared/utils/finago-order-posting", () => ({
  postFinagoTransactionForOrder: mocks.postFinagoTransactionForOrder,
}));
vi.mock("@repo/shared/utils/membership-fulfilment", () => ({
  fulfilMembershipOrder: mocks.fulfilMembershipOrder,
  isMembershipOrder: mocks.isMembershipOrder,
}));
vi.mock("@repo/shared/utils/stripe-pure", () => ({
  determineStatusFromStripeSession: mocks.determineStatusFromStripeSession,
}));
vi.mock("@repo/shared/utils/vipps-order-ops", () => ({
  applyOrderStatusTransition: mocks.applyOrderStatusTransition,
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);

const db = {
  getRow: vi.fn(),
};

function vippsCallbackRequest(): NextRequest {
  return new Request("https://api.biso.no/api/payment/vipps/callback", {
    body: JSON.stringify({ name: "epayment.payment.captured.v1" }),
    headers: new Headers({ "content-type": "application/json" }),
    method: "POST",
  }) as unknown as NextRequest;
}

function stripeCallbackRequest(): NextRequest {
  return new Request("https://api.biso.no/api/payment/stripe/callback", {
    body: "{}",
    headers: new Headers({
      "content-type": "application/json",
      "stripe-signature": "test-signature",
    }),
    method: "POST",
  }) as unknown as NextRequest;
}

async function postVippsCallback() {
  return await POST(vippsCallbackRequest(), {
    params: Promise.resolve({ provider: "vipps" }),
  });
}

async function postStripeCallback() {
  return await POST(stripeCallbackRequest(), {
    params: Promise.resolve({ provider: "stripe" }),
  });
}

// Covers `settleFinagoIfPaid`, the shared helper both the Vipps and Stripe
// handlers call after a status transition. Signature verification and
// provider-session parsing are mocked away (they're covered by
// vipps/webhook and stripe unit tests elsewhere) so these tests are isolated
// to the one thing Task 18 changed: does a paid order get routed to
// fulfilMembershipOrder or postFinagoTransactionForOrder, never both.
describe("payment callback: settlement routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    mockedCreateAdminClient.mockResolvedValue({ db } as never);
    mocks.resolveVippsCredentials.mockResolvedValue({
      webhookSecret: "vipps-secret",
    });
    mocks.resolveStripeCredentials.mockResolvedValue({
      secretKey: "stripe-secret",
      testMode: true,
      webhookSecret: "stripe-webhook",
    });
    mocks.verifyVippsWebhookSignature.mockReturnValue(true);
    mocks.parseVippsWebhookEvent.mockReturnValue({
      name: "epayment.payment.captured.v1",
      reference: "order-1",
    });
    mocks.reconcileVippsPayment.mockResolvedValue(undefined);
    mocks.verifyStripeWebhook.mockReturnValue({
      data: { object: { metadata: { orderId: "order-1" } } },
      type: "checkout.session.completed",
    });
    mocks.determineStatusFromStripeSession.mockReturnValue({
      status: "paid",
      updateData: {},
    });
    mocks.applyOrderStatusTransition.mockResolvedValue({ newStatus: "paid" });
    mocks.isMembershipOrder.mockReturnValue(false);
    mocks.fulfilMembershipOrder.mockResolvedValue({ fulfilled: false });
    mocks.postFinagoTransactionForOrder.mockResolvedValue({ posted: false });
  });

  describe("vipps handler", () => {
    it("fulfils a paid membership order instead of posting a shop transaction", async () => {
      db.getRow.mockResolvedValue({ items_json: "[]", status: "paid" });
      mocks.isMembershipOrder.mockReturnValue(true);

      await postVippsCallback();

      expect(mocks.fulfilMembershipOrder).toHaveBeenCalledWith("order-1", db);
      expect(mocks.postFinagoTransactionForOrder).not.toHaveBeenCalled();
    });

    it("posts a paid shop order instead of fulfilling a membership", async () => {
      db.getRow.mockResolvedValue({ items_json: "[]", status: "paid" });
      mocks.isMembershipOrder.mockReturnValue(false);

      await postVippsCallback();

      expect(mocks.postFinagoTransactionForOrder).toHaveBeenCalledWith(
        "order-1",
        db
      );
      expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    });

    it("settles neither path for an order that is not paid or authorized", async () => {
      db.getRow.mockResolvedValue({ items_json: "[]", status: "pending" });

      await postVippsCallback();

      expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
      expect(mocks.postFinagoTransactionForOrder).not.toHaveBeenCalled();
    });
  });

  describe("stripe handler", () => {
    it("fulfils a paid membership order instead of posting a shop transaction", async () => {
      db.getRow.mockResolvedValue({ items_json: "[]", status: "paid" });
      mocks.isMembershipOrder.mockReturnValue(true);

      await postStripeCallback();

      expect(mocks.fulfilMembershipOrder).toHaveBeenCalledWith("order-1", db);
      expect(mocks.postFinagoTransactionForOrder).not.toHaveBeenCalled();
    });

    it("posts a paid shop order instead of fulfilling a membership", async () => {
      db.getRow.mockResolvedValue({ items_json: "[]", status: "paid" });
      mocks.isMembershipOrder.mockReturnValue(false);

      await postStripeCallback();

      expect(mocks.postFinagoTransactionForOrder).toHaveBeenCalledWith(
        "order-1",
        db
      );
      expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    });

    it("settles neither path for an order that is not paid or authorized", async () => {
      db.getRow.mockResolvedValue({ items_json: "[]", status: "pending" });

      await postStripeCallback();

      expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
      expect(mocks.postFinagoTransactionForOrder).not.toHaveBeenCalled();
    });
  });
});
