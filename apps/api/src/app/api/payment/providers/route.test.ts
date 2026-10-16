import { createAdminClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getFeatureFlagStates: vi.fn(),
  resolveStripeCredentials: vi.fn(),
  resolveVippsCredentials: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({ createAdminClient: vi.fn() }));
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  getFeatureFlagStates: mocks.getFeatureFlagStates,
}));
vi.mock("@repo/payment/credentials", () => ({
  resolveStripeCredentials: mocks.resolveStripeCredentials,
  resolveVippsCredentials: mocks.resolveVippsCredentials,
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);

function request(): NextRequest {
  return new Request(
    "https://api.biso.no/api/payment/providers"
  ) as unknown as NextRequest;
}

async function providersFrom(response: Response) {
  const body = (await response.json()) as {
    providers: Array<{ available: boolean; configured: boolean; id: string }>;
  };
  return Object.fromEntries(
    body.providers.map((provider) => [provider.id, provider])
  );
}

describe("payment providers availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateAdminClient.mockResolvedValue({ db: {} } as unknown as Awaited<
      ReturnType<typeof createAdminClient>
    >);
    mocks.getFeatureFlagStates.mockResolvedValue({
      payments_stripe: true,
      payments_vipps: true,
    });
    mocks.resolveVippsCredentials.mockResolvedValue({ clientId: "vipps" });
    mocks.resolveStripeCredentials.mockResolvedValue({ secretKey: "stripe" });
  });

  it("reports a provider as available when it is enabled and configured", async () => {
    const providers = await providersFrom(await GET(request()));

    expect(providers.vipps).toMatchObject({ available: true, enabled: true });
    expect(providers.stripe).toMatchObject({ available: true, enabled: true });
  });

  it("hides a provider the admin app has switched off", async () => {
    mocks.getFeatureFlagStates.mockResolvedValue({
      payments_stripe: false,
      payments_vipps: true,
    });

    const providers = await providersFrom(await GET(request()));

    expect(providers.stripe).toMatchObject({
      available: false,
      configured: true,
      enabled: false,
    });
    expect(providers.vipps.available).toBe(true);
  });

  it("hides an enabled provider whose credentials are missing", async () => {
    mocks.resolveStripeCredentials.mockResolvedValue(null);

    const providers = await providersFrom(await GET(request()));

    expect(providers.stripe).toMatchObject({
      available: false,
      configured: false,
      enabled: true,
    });
  });

  it("fails closed when availability cannot be resolved", async () => {
    mocks.getFeatureFlagStates.mockRejectedValue(new Error("appwrite down"));

    const response = await GET(request());

    expect(response.status).toBe(503);
  });
});
