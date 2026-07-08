import { OrdersStatus } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { determineStatusFromStripeSession } from "./stripe-pure";

describe("determineStatusFromStripeSession", () => {
  it("maps a paid, completed session to PAID and records the intent id", () => {
    const result = determineStatusFromStripeSession({
      status: "complete",
      payment_status: "paid",
      payment_intent: "pi_1",
    });
    expect(result.status).toBe(OrdersStatus.PAID);
    expect(result.updateData.payment_intent_id).toBe("pi_1");
  });

  it("maps a completed-but-unpaid session to PENDING (async payment still settling)", () => {
    expect(
      determineStatusFromStripeSession({
        status: "complete",
        payment_status: "unpaid",
      }).status
    ).toBe(OrdersStatus.PENDING);
  });

  it("maps an async_payment_failed event to CANCELLED even though the session is complete/unpaid", () => {
    expect(
      determineStatusFromStripeSession(
        {
          status: "complete",
          payment_status: "unpaid",
        },
        "checkout.session.async_payment_failed"
      ).status
    ).toBe(OrdersStatus.CANCELLED);
  });

  it("maps an expired session to CANCELLED even if unpaid", () => {
    expect(
      determineStatusFromStripeSession({
        status: "expired",
        payment_status: "unpaid",
      }).status
    ).toBe(OrdersStatus.CANCELLED);
  });

  it("maps a still-open session to PENDING", () => {
    expect(
      determineStatusFromStripeSession({
        status: "open",
        payment_status: "unpaid",
      }).status
    ).toBe(OrdersStatus.PENDING);
  });

  it("reads the payment intent id from an expanded object", () => {
    expect(
      determineStatusFromStripeSession({
        status: "complete",
        payment_status: "paid",
        payment_intent: { id: "pi_obj" },
      }).updateData.payment_intent_id
    ).toBe("pi_obj");
  });
});
