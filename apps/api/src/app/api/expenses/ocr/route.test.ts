import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
}));

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  getFeatureFlagStates: vi.fn(async () => ({
    expenses_module: false,
    expenses_ocr: false,
  })),
}));

vi.mock("@repo/ai/models", () => ({}));
vi.mock("ai", () => ({ generateObject: vi.fn() }));

import { POST } from "./route";

const ORIGIN = "http://localhost:3000";

function request() {
  return new Request("https://api.example/api/expenses/ocr", {
    headers: { origin: ORIGIN },
    method: "POST",
  }) as never;
}

describe("expenses/ocr auth", () => {
  beforeEach(() => {
    account.get.mockReset();
  });

  it("answers a CORS-enabled JSON 401 when the session is rejected", async () => {
    account.get.mockRejectedValue(
      Object.assign(new Error("missing scope"), { code: 401 })
    );

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("answers 500 when the auth check fails for a non-auth reason", async () => {
    account.get.mockRejectedValue(new TypeError("fetch failed"));

    const response = await POST(request());

    expect(response.status).toBe(500);
  });

  it("proceeds past auth for a valid session", async () => {
    account.get.mockResolvedValue({ $id: "user-1" });

    const response = await POST(request());

    // Flags are off in this test, so the next gate answers 403.
    expect(response.status).toBe(403);
  });
});
