import { createAdminClient } from "@repo/api/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  isMembershipOrder: vi.fn(),
  reconcileOrderPayment: vi.fn(),
  settleOrderIfPaid: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({ createAdminClient: vi.fn() }));
vi.mock("@repo/payment/reconcile", () => ({
  reconcileOrderPayment: mocks.reconcileOrderPayment,
}));
vi.mock("@repo/shared/utils/order-settlement", () => ({
  settleOrderIfPaid: mocks.settleOrderIfPaid,
}));
vi.mock("@repo/shared/utils/membership-fulfilment", () => ({
  isMembershipOrder: mocks.isMembershipOrder,
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const db = { getRow: vi.fn() };

function returnRequest(query: string): Request {
  return new Request(`https://api.biso.no/api/payment/return?${query}`);
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    $id: "order-1",
    order_items: [],
    payment_session_id: "session-1",
    status: "paid",
    ...overrides,
  };
}

describe("payment return", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "https://biso.no");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedCreateAdminClient.mockResolvedValue({ db } as never);
    mocks.reconcileOrderPayment.mockResolvedValue(undefined);
    mocks.settleOrderIfPaid.mockResolvedValue(undefined);
    mocks.isMembershipOrder.mockReturnValue(false);
    db.getRow.mockResolvedValue(order());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reconciles, settles, and sends a paid web buyer to the receipt", async () => {
    const response = await GET(returnRequest("orderId=order-1"));

    expect(mocks.reconcileOrderPayment).toHaveBeenCalledWith("order-1", db);
    expect(mocks.settleOrderIfPaid).toHaveBeenCalledWith("order-1", db);
    expect(response.headers.get("location")).toBe(
      "https://biso.no/shop/order/order-1?success=true"
    );
  });

  it("skips the provider round-trip for an order with no payment session", async () => {
    db.getRow.mockResolvedValue(order({ payment_session_id: null }));

    await GET(returnRequest("orderId=order-1"));

    expect(mocks.reconcileOrderPayment).not.toHaveBeenCalled();
    expect(mocks.settleOrderIfPaid).toHaveBeenCalledWith("order-1", db);
  });

  it("still redirects when the provider check fails", async () => {
    mocks.reconcileOrderPayment.mockRejectedValue(new Error("vipps down"));

    const response = await GET(returnRequest("orderId=order-1"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/shop/order/order-1?success=true"
    );
  });

  it("sends a cancelled membership buyer back to the join flow", async () => {
    db.getRow.mockResolvedValue(order({ status: "cancelled" }));
    mocks.isMembershipOrder.mockReturnValue(true);

    const response = await GET(returnRequest("orderId=order-1"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/membership/join?cancelled=true"
    );
  });

  it("sends a failed shop buyer back to the cart", async () => {
    db.getRow.mockResolvedValue(order({ status: "failed" }));

    const response = await GET(returnRequest("orderId=order-1"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/shop/cart?error=payment_failed"
    );
  });

  it("deep-links an app buyer back into the app with the status", async () => {
    const response = await GET(returnRequest("orderId=order-1&client=app"));

    expect(response.headers.get("location")).toBe(
      "biso://shop/order?orderId=order-1&status=paid"
    );
  });

  it("sends a cancelled app checkout to the app cart", async () => {
    db.getRow.mockResolvedValue(order({ status: "pending" }));

    const response = await GET(
      returnRequest("orderId=order-1&client=app&cancelled=1")
    );

    expect(response.headers.get("location")).toBe(
      "biso://shop/cart?cancelled=1"
    );
  });

  it("sends a request without an order id to the shop", async () => {
    const response = await GET(returnRequest(""));

    expect(response.headers.get("location")).toBe("https://biso.no/shop");
    expect(mocks.settleOrderIfPaid).not.toHaveBeenCalled();
  });

  it("sends an unreadable order to the shop with an error", async () => {
    db.getRow.mockRejectedValue(new Error("appwrite down"));

    const response = await GET(returnRequest("orderId=order-1"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/shop?error=unknown"
    );
  });

  it("never shows a paid order as cancelled to the app, even with a crafted cancel marker", async () => {
    db.getRow.mockResolvedValue(order({ status: "paid" }));

    const response = await GET(
      returnRequest("orderId=order-1&client=app&cancelled=1")
    );

    expect(response.headers.get("location")).toBe(
      "biso://shop/order?orderId=order-1&status=paid"
    );
  });

  it("sends an app request with no orderId to the app shop", async () => {
    const response = await GET(returnRequest("client=app"));

    expect(response.headers.get("location")).toBe("biso://shop");
  });

  it("sends an app request whose order read fails to the app order deep link", async () => {
    db.getRow.mockRejectedValue(new Error("appwrite down"));

    const response = await GET(returnRequest("orderId=order-1&client=app"));

    expect(response.headers.get("location")).toBe(
      "biso://shop/order?orderId=order-1"
    );
  });

  it("sends a not-found order to the shop with order_not_found, not the generic error", async () => {
    db.getRow.mockRejectedValue(
      Object.assign(new Error("row_not_found"), {
        code: 404,
        type: "row_not_found",
      })
    );

    const response = await GET(returnRequest("orderId=order-1"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/shop?error=order_not_found"
    );
  });
});
