import { createAdminClient } from "@repo/api/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  fulfilMembershipOrder: vi.fn(),
  isMembershipOrder: vi.fn(),
  postFinagoTransactionForOrder: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@repo/shared/utils/finago-order-posting", () => ({
  postFinagoTransactionForOrder: mocks.postFinagoTransactionForOrder,
}));
vi.mock("@repo/shared/utils/membership-fulfilment", () => ({
  fulfilMembershipOrder: mocks.fulfilMembershipOrder,
  isMembershipOrder: mocks.isMembershipOrder,
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);

const db = {
  getRow: vi.fn(),
};

function returnRequest(orderId = "order-1"): Request {
  return new Request(
    `https://web.biso.no/api/checkout/return?orderId=${orderId}`
  );
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    $id: "order-1",
    items_json: "[]",
    // No payment_session_id: syncOrderStatusFromProvider short-circuits
    // before touching Vipps/Stripe, so this test is isolated to the one
    // thing Task 18 changed — whether a paid order is routed to
    // fulfilMembershipOrder or postFinagoTransactionForOrder.
    payment_session_id: null,
    status: "paid",
    ...overrides,
  };
}

describe("checkout return: settlement routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    mockedCreateAdminClient.mockResolvedValue({ db } as never);
    mocks.fulfilMembershipOrder.mockResolvedValue({ fulfilled: false });
    mocks.postFinagoTransactionForOrder.mockResolvedValue({ posted: false });
  });

  it("fulfils a paid membership order instead of posting a shop transaction", async () => {
    db.getRow.mockResolvedValue(order());
    mocks.isMembershipOrder.mockReturnValue(true);

    await GET(returnRequest());

    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledWith("order-1", db);
    expect(mocks.postFinagoTransactionForOrder).not.toHaveBeenCalled();
  });

  it("posts a paid shop order instead of fulfilling a membership", async () => {
    db.getRow.mockResolvedValue(order());
    mocks.isMembershipOrder.mockReturnValue(false);

    await GET(returnRequest());

    expect(mocks.postFinagoTransactionForOrder).toHaveBeenCalledWith(
      "order-1",
      db
    );
    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
  });

  it("settles neither path for an order that is not paid or authorized", async () => {
    db.getRow.mockResolvedValue(order({ status: "pending" }));

    await GET(returnRequest());

    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    expect(mocks.postFinagoTransactionForOrder).not.toHaveBeenCalled();
  });
});
