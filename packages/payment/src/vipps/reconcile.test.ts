import { OrdersStatus } from "@repo/api/types/appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { info, capture, applyTransition, resolveCreds } = vi.hoisted(() => ({
  info: vi.fn(),
  capture: vi.fn(),
  applyTransition: vi.fn(),
  resolveCreds: vi.fn(),
}));

vi.mock("./client", () => ({
  buildVippsClient: () => ({
    payment: {
      info: (_token: string, reference: string) => info(reference),
      capture: (_token: string, reference: string, body: unknown) =>
        capture(reference, body),
    },
  }),
  getVippsAccessToken: () => Promise.resolve("token"),
}));

vi.mock("../credentials", () => ({
  resolveVippsCredentials: () => resolveCreds(),
}));

vi.mock("@repo/shared/utils/vipps-order-ops", () => ({
  applyOrderStatusTransition: (...args: unknown[]) => applyTransition(...args),
}));

const { reconcileVippsPayment } = await import("./index");

function agg(values: {
  authorized?: number;
  captured?: number;
  cancelled?: number;
  refunded?: number;
}) {
  return {
    authorizedAmount: { value: values.authorized ?? 0, currency: "NOK" },
    capturedAmount: { value: values.captured ?? 0, currency: "NOK" },
    cancelledAmount: { value: values.cancelled ?? 0, currency: "NOK" },
    refundedAmount: { value: values.refunded ?? 0, currency: "NOK" },
  };
}

function vippsOrder(overrides: Record<string, unknown> = {}) {
  return {
    payment_provider: "vipps",
    payment_session_id: "order-1",
    status: "pending",
    total: 199,
    currency: "NOK",
    ...overrides,
  };
}

describe("reconcileVippsPayment", () => {
  beforeEach(() => {
    process.env.APPWRITE_DATABASE_ID = "app";
    process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
    info.mockReset();
    capture.mockReset();
    applyTransition.mockReset();
    resolveCreds.mockReset();
    resolveCreds.mockResolvedValue({
      clientId: "c",
      clientSecret: "s",
      merchantSerialNumber: "m",
      subscriptionKey: "k",
      testMode: true,
      webhookSecret: "w",
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("captures an authorized payment with a matching amount and marks it PAID", async () => {
    const db = { getRow: vi.fn().mockResolvedValue(vippsOrder()) };
    info.mockResolvedValue({
      ok: true,
      data: { state: "AUTHORIZED", pspReference: "psp", aggregate: agg({ authorized: 19_900 }) },
    });
    capture.mockResolvedValue({
      ok: true,
      data: {
        state: "AUTHORIZED",
        pspReference: "psp",
        aggregate: agg({ authorized: 19_900, captured: 19_900 }),
      },
    });

    await reconcileVippsPayment("order-1", db as never);

    expect(capture).toHaveBeenCalledWith("order-1", {
      modificationAmount: { currency: "NOK", value: 19_900 },
    });
    expect(applyTransition).toHaveBeenCalledWith(
      "order-1",
      OrdersStatus.PAID,
      expect.objectContaining({ payment_intent_id: "psp" }),
      db
    );
  });

  it("does not capture when the authorized amount does not match the order total", async () => {
    const db = { getRow: vi.fn().mockResolvedValue(vippsOrder({ total: 200 })) };
    info.mockResolvedValue({
      ok: true,
      data: { state: "AUTHORIZED", pspReference: "psp", aggregate: agg({ authorized: 19_900 }) },
    });

    await reconcileVippsPayment("order-1", db as never);

    expect(capture).not.toHaveBeenCalled();
    expect(applyTransition).toHaveBeenCalledWith(
      "order-1",
      OrdersStatus.AUTHORIZED,
      expect.anything(),
      db
    );
  });

  it("skips capture when the payment is already captured", async () => {
    const db = { getRow: vi.fn().mockResolvedValue(vippsOrder()) };
    info.mockResolvedValue({
      ok: true,
      data: {
        state: "AUTHORIZED",
        pspReference: "psp",
        aggregate: agg({ authorized: 19_900, captured: 19_900 }),
      },
    });

    await reconcileVippsPayment("order-1", db as never);

    expect(capture).not.toHaveBeenCalled();
    expect(applyTransition).toHaveBeenCalledWith(
      "order-1",
      OrdersStatus.PAID,
      expect.anything(),
      db
    );
  });

  it("is a no-op for non-Vipps orders", async () => {
    const db = {
      getRow: vi.fn().mockResolvedValue(vippsOrder({ payment_provider: "stripe" })),
    };

    await reconcileVippsPayment("order-1", db as never);

    expect(info).not.toHaveBeenCalled();
    expect(applyTransition).not.toHaveBeenCalled();
  });
});
