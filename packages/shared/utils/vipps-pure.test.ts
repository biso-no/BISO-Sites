import { OrdersStatus } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import type { VippsPaymentState } from "../types/vipps";
import {
  determineStatusFromPaymentState,
  type VippsSessionData,
} from "./vipps-pure";

const emptySession: VippsSessionData = {};

function session(
  aggregate: NonNullable<NonNullable<VippsSessionData["payment"]>["aggregate"]>
): VippsSessionData {
  return { payment: { aggregate } } as VippsSessionData;
}

describe("determineStatusFromPaymentState", () => {
  it("maps CREATED to PENDING", () => {
    const { status } = determineStatusFromPaymentState(
      { state: "CREATED" } as VippsPaymentState,
      emptySession
    );
    expect(status).toBe(OrdersStatus.PENDING);
  });

  it("maps AUTHORIZED to AUTHORIZED and records the amount", () => {
    const { status, updateData } = determineStatusFromPaymentState(
      { state: "AUTHORIZED" } as VippsPaymentState,
      session({ authorizedAmount: { value: 19_900 } })
    );
    expect(status).toBe(OrdersStatus.AUTHORIZED);
    expect(updateData.payment_intent_id).toBe("19900");
  });

  it("maps ABORTED, EXPIRED, and TERMINATED to CANCELLED", () => {
    for (const state of ["ABORTED", "EXPIRED", "TERMINATED"] as const) {
      const { status } = determineStatusFromPaymentState(
        { state } as VippsPaymentState,
        emptySession
      );
      expect(status).toBe(OrdersStatus.CANCELLED);
    }
  });

  it("upgrades to PAID when any amount is captured, regardless of state", () => {
    const { status, updateData } = determineStatusFromPaymentState(
      { state: "AUTHORIZED" } as VippsPaymentState,
      session({
        capturedAmount: { value: 19_900 },
        receipt: { url: "https://example.com/receipt" },
      })
    );
    expect(status).toBe(OrdersStatus.PAID);
    expect(updateData.payment_receipt_url).toBe("https://example.com/receipt");
  });

  it("does not mark PAID on a zero captured amount", () => {
    const { status } = determineStatusFromPaymentState(
      { state: "CREATED" } as VippsPaymentState,
      session({ capturedAmount: { value: 0 } })
    );
    expect(status).toBe(OrdersStatus.PENDING);
  });

  it("falls back to PENDING on unknown states", () => {
    const { status } = determineStatusFromPaymentState(
      { state: "SOMETHING_NEW" } as unknown as VippsPaymentState,
      emptySession
    );
    expect(status).toBe(OrdersStatus.PENDING);
  });
});
