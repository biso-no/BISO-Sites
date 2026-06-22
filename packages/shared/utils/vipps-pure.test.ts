import { OrdersStatus } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import type { VippsAggregate, VippsState } from "../types/vipps";
import { determineStatusFromPaymentState } from "./vipps-pure";

function snapshot(state: VippsState, aggregate?: VippsAggregate, pspReference?: string) {
  return { state, aggregate, pspReference };
}

describe("determineStatusFromPaymentState", () => {
  it("maps CREATED to PENDING", () => {
    const { status } = determineStatusFromPaymentState(snapshot("CREATED"));
    expect(status).toBe(OrdersStatus.PENDING);
  });

  it("maps AUTHORIZED to AUTHORIZED and records the psp reference", () => {
    const { status, updateData } = determineStatusFromPaymentState(
      snapshot("AUTHORIZED", { authorizedAmount: { value: 19_900 } }, "psp-123")
    );
    expect(status).toBe(OrdersStatus.AUTHORIZED);
    expect(updateData.payment_intent_id).toBe("psp-123");
  });

  it("maps ABORTED and EXPIRED to CANCELLED", () => {
    for (const state of ["ABORTED", "EXPIRED"] as const) {
      const { status } = determineStatusFromPaymentState(snapshot(state));
      expect(status).toBe(OrdersStatus.CANCELLED);
    }
  });

  it("maps TERMINATED to FAILED", () => {
    const { status } = determineStatusFromPaymentState(snapshot("TERMINATED"));
    expect(status).toBe(OrdersStatus.FAILED);
  });

  it("upgrades to PAID when an amount is captured, regardless of state", () => {
    const { status } = determineStatusFromPaymentState(
      snapshot("AUTHORIZED", {
        authorizedAmount: { value: 19_900 },
        capturedAmount: { value: 19_900 },
      })
    );
    expect(status).toBe(OrdersStatus.PAID);
  });

  it("keeps PAID on a partial refund", () => {
    const { status } = determineStatusFromPaymentState(
      snapshot("AUTHORIZED", {
        capturedAmount: { value: 19_900 },
        refundedAmount: { value: 5000 },
      })
    );
    expect(status).toBe(OrdersStatus.PAID);
  });

  it("maps a full refund to REFUNDED", () => {
    const { status } = determineStatusFromPaymentState(
      snapshot("AUTHORIZED", {
        capturedAmount: { value: 19_900 },
        refundedAmount: { value: 19_900 },
      })
    );
    expect(status).toBe(OrdersStatus.REFUNDED);
  });

  it("maps a post-authorization cancellation to CANCELLED", () => {
    const { status } = determineStatusFromPaymentState(
      snapshot("AUTHORIZED", {
        authorizedAmount: { value: 19_900 },
        cancelledAmount: { value: 19_900 },
      })
    );
    expect(status).toBe(OrdersStatus.CANCELLED);
  });

  it("does not mark PAID on a zero captured amount", () => {
    const { status } = determineStatusFromPaymentState(
      snapshot("CREATED", { capturedAmount: { value: 0 } })
    );
    expect(status).toBe(OrdersStatus.PENDING);
  });

  it("falls back to PENDING on unknown states", () => {
    const { status } = determineStatusFromPaymentState(
      snapshot("SOMETHING_NEW" as unknown as VippsState)
    );
    expect(status).toBe(OrdersStatus.PENDING);
  });
});
