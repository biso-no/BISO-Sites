import { createAdminClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedClient } from "@/lib/auth";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  reconcileOrderPayment: vi.fn(),
  settleOrderIfPaid: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ createAuthenticatedClient: vi.fn() }));
vi.mock("@repo/payment/reconcile", () => ({
  reconcileOrderPayment: mocks.reconcileOrderPayment,
}));
vi.mock("@repo/shared/utils/order-settlement", () => ({
  settleOrderIfPaid: mocks.settleOrderIfPaid,
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCreateAuthenticatedClient = vi.mocked(createAuthenticatedClient);

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    $createdAt: "2026-09-01T10:00:00.000+00:00",
    $id: "order-1",
    currency: "NOK",
    order_items: [],
    status: "pending",
    subtotal: 199,
    total: 199,
    userId: "buyer-1",
    ...overrides,
  };
}

function mockBuyer(row: Record<string, unknown> | null, userId = "buyer-1") {
  const getRow = row
    ? vi.fn().mockResolvedValue(row)
    : vi.fn().mockRejectedValue(new Error("row_not_found"));
  mockedCreateAuthenticatedClient.mockResolvedValue({
    account: { get: vi.fn().mockResolvedValue({ $id: userId }) },
    db: { getRow },
  } as unknown as Awaited<ReturnType<typeof createAuthenticatedClient>>);
  return getRow;
}

function request(authorized = true): NextRequest {
  const headers = new Headers();
  if (authorized) {
    headers.set("authorization", "Bearer valid");
  }
  return new Request("https://api.biso.no/api/payment/orders/order-1", {
    headers,
  }) as unknown as NextRequest;
}

const params = { params: Promise.resolve({ orderId: "order-1" }) };

describe("buyer order verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdminClient.mockResolvedValue({ db: {} } as unknown as Awaited<
      ReturnType<typeof createAdminClient>
    >);
    mocks.reconcileOrderPayment.mockResolvedValue(undefined);
    mocks.settleOrderIfPaid.mockResolvedValue(undefined);
  });

  it("requires authentication", async () => {
    const response = await GET(request(false), params);

    expect(response.status).toBe(401);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("reconciles and settles an order still awaiting payment", async () => {
    mockBuyer(orderRow());

    const response = await GET(request(), params);

    expect(response.status).toBe(200);
    expect(mocks.reconcileOrderPayment).toHaveBeenCalledWith(
      "order-1",
      expect.anything()
    );
    expect(mocks.settleOrderIfPaid).toHaveBeenCalledWith(
      "order-1",
      expect.anything()
    );
  });

  it("retries settlement for an order the webhook already marked paid", async () => {
    mockBuyer(orderRow({ status: "paid" }));

    const response = await GET(request(), params);

    expect(response.status).toBe(200);
    // The settlement helpers swallow transient failures, so a paid order can
    // still be owed its ledger posting. Retrying is a no-op once it settled.
    expect(mocks.settleOrderIfPaid).toHaveBeenCalledWith(
      "order-1",
      expect.anything()
    );
    // ...but a settled payment needs no provider round-trip.
    expect(mocks.reconcileOrderPayment).not.toHaveBeenCalled();
  });

  it("leaves a refunded order alone entirely", async () => {
    mockBuyer(orderRow({ status: "refunded" }));

    const response = await GET(request(), params);

    expect(response.status).toBe(200);
    expect(mocks.reconcileOrderPayment).not.toHaveBeenCalled();
    expect(mocks.settleOrderIfPaid).not.toHaveBeenCalled();
  });

  it("does not expose an order belonging to someone else", async () => {
    mockBuyer(orderRow({ userId: "someone-else" }));

    const response = await GET(request(), params);

    expect(response.status).toBe(404);
    expect(mocks.settleOrderIfPaid).not.toHaveBeenCalled();
  });

  it("reports an unreadable order as not found", async () => {
    mockBuyer(null);

    const response = await GET(request(), params);

    expect(response.status).toBe(404);
  });

  it("projects the order for the app's confirmation screen", async () => {
    mockBuyer(
      orderRow({
        discount_total: 40,
        member_discount_percent: 10,
        membership_applied: true,
        order_items: [
          {
            $id: "line-1",
            line_total: 358,
            name: "BISO Hoodie — Large",
            quantity: 2,
            unit_price: 179,
          },
        ],
        payment_provider: "vipps",
        status: "paid",
        total: 358,
      })
    );

    const response = await GET(request(), params);

    await expect(response.json()).resolves.toMatchObject({
      currency: "NOK",
      discountTotal: 40,
      id: "order-1",
      items: [{ lineTotal: 358, quantity: 2, unitPrice: 179 }],
      membershipApplied: true,
      paymentProvider: "vipps",
      status: "paid",
      total: 358,
    });
  });
});
