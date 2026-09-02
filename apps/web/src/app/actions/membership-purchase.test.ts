import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  get: vi.fn(),
  getSession: vi.fn(),
}));

// `createJWT` moved from `Account` to `Users` in node-appwrite@28, so minting
// now needs the admin client too — see `lib/actions/session-jwt`.
const users = vi.hoisted(() => ({
  createJWT: vi.fn(),
}));

const sessionDb = vi.hoisted(() => ({
  getRow: vi.fn(),
}));

const adminDb = vi.hoisted(() => ({
  updateRow: vi.fn(),
}));

const catalog = vi.hoisted(() => ({
  getMembershipPlanById: vi.fn(),
}));

const featureFlags = vi.hoisted(() => ({
  getFeatureFlagStates: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb, users })),
  createSessionClient: vi.fn(async () => ({ account, db: sessionDb })),
}));

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  getFeatureFlagStates: featureFlags.getFeatureFlagStates,
}));

vi.mock("@/lib/membership-catalog", () => ({
  getMembershipPlanById: catalog.getMembershipPlanById,
}));

import { startMembershipCheckout } from "./membership-purchase";

const VALID_PLAN = {
  id: "71",
  name: "BISO Membership fall 2026 and spring 2027",
  price: 550,
  productId: 71,
  categoryId: 113_178,
  duration: "year",
  accrualMonths: 12,
  startDate: "2026-08-01",
  expiryDate: "2027-06-30",
};

const VALID_PROFILE = {
  $id: "user-1",
  student_id: "s1715738",
  bi_employee_id: "employee-1",
};

function stubCheckoutFetch() {
  const fetchMock = vi.fn(async () =>
    Response.json({
      checkoutUrl: "https://vipps.example/checkout",
      orderId: "order-1",
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function fetchRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe("startMembershipCheckout", () => {
  beforeEach(() => {
    featureFlags.getFeatureFlagStates.mockResolvedValue({
      payments_stripe: true,
      payments_vipps: true,
    });
    account.get.mockResolvedValue({ $id: "user-1" });
    account.getSession.mockResolvedValue({ $id: "session-id" });
    users.createJWT.mockResolvedValue({ jwt: "session-jwt" });
    sessionDb.getRow.mockResolvedValue(VALID_PROFILE);
    adminDb.updateRow.mockResolvedValue({});
    catalog.getMembershipPlanById.mockResolvedValue(VALID_PLAN);
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects a campusId that resolves via the Object.prototype chain instead of a real campus entry", async () => {
    const fetchMock = stubCheckoutFetch();

    const result = await startMembershipCheckout({
      campusId: "constructor",
      planId: "71",
      provider: "vipps",
    });

    expect(result).toEqual({ success: false, error: "Select a valid campus." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a provider value that would path-traverse the outbound checkout URL", async () => {
    const fetchMock = stubCheckoutFetch();

    const result = await startMembershipCheckout({
      campusId: "1",
      planId: "71",
      // @ts-expect-error — deliberately outside the "vipps" | "stripe" union to
      // exercise the runtime guard a publicly callable server action needs.
      provider: "vipps/../../orders/1",
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid payment provider.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    account.get.mockResolvedValue(null);
    const fetchMock = stubCheckoutFetch();

    const result = await startMembershipCheckout({
      campusId: "1",
      planId: "71",
      provider: "vipps",
    });

    expect(result).toEqual({
      success: false,
      error: "You must be signed in.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a profile with no bi_employee_id (no Finago customer number)", async () => {
    sessionDb.getRow.mockResolvedValue({
      ...VALID_PROFILE,
      bi_employee_id: null,
    });
    const fetchMock = stubCheckoutFetch();

    const result = await startMembershipCheckout({
      campusId: "1",
      planId: "71",
      provider: "vipps",
    });

    expect(result).toEqual({
      success: false,
      error:
        "We could not verify your BI student record. Please contact us so we can help.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a plan that is no longer purchasable", async () => {
    catalog.getMembershipPlanById.mockResolvedValue(null);
    const fetchMock = stubCheckoutFetch();

    const result = await startMembershipCheckout({
      campusId: "1",
      planId: "missing-plan",
      provider: "vipps",
    });

    expect(result).toEqual({
      success: false,
      error: "That membership is no longer available.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts checkout and sends only planId and campusId — never a price", async () => {
    const fetchMock = stubCheckoutFetch();

    const result = await startMembershipCheckout({
      campusId: "1",
      planId: "71",
      provider: "vipps",
    });

    expect(result).toEqual({
      success: true,
      paymentUrl: "https://vipps.example/checkout",
      orderId: "order-1",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.biso.no/api/payment/vipps/membership-checkout",
      expect.objectContaining({ method: "POST" })
    );

    const body = fetchRequestBody(fetchMock);
    expect(body).toEqual({ planId: "71", campusId: "1" });
    expect(body).not.toHaveProperty("price");
    expect(body).not.toHaveProperty("total");
    expect(body).not.toHaveProperty("amount");
  });
});
