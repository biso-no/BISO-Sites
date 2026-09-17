import { beforeEach, describe, expect, it, vi } from "vitest";

const TOTP_KEY_HEX_RE = /^[0-9a-f]{40}$/;

const resolveMemberPassForRequest = vi.hoisted(() => vi.fn());
const readGoogleWalletConfig = vi.hoisted(() => vi.fn());
const signGoogleSaveJwt = vi.hoisted(() =>
  vi.fn((_input: unknown) => "header.payload.sig")
);

const syncGoogleWalletPass = vi.hoisted(() =>
  vi.fn(async (_config: unknown, _object: unknown) => undefined)
);

vi.mock("server-only", () => ({}));
vi.mock("@repo/shared/member-pass/google-wallet-api", () => ({
  syncGoogleWalletPass,
}));
vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPassForRequest }));
vi.mock("@repo/shared/member-pass/wallet-config", () => ({
  readGoogleWalletConfig,
}));
vi.mock("@repo/shared/member-pass/google-pass", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@repo/shared/member-pass/google-pass")
  >()),
  signGoogleSaveJwt,
}));

import { GET, OPTIONS } from "./route";

const ACTIVE = {
  holder: {
    expiryDate: "2026-12-31",
    membershipName: "Semester",
    name: "M",
    startDate: "2026-07-01",
    term: null,
  },
  state: "active",
  userId: "user-1",
};

function request(headers: Record<string, string> = {}) {
  return new Request("https://api.biso.no/api/member-pass/google", {
    headers: { authorization: "Bearer jwt", ...headers },
  }) as never;
}

describe("GET /api/member-pass/google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "MEMBER_PASS_SECRET",
      "test-secret-that-is-at-least-32-characters-long"
    );
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "https://biso.no");
    readGoogleWalletConfig.mockReturnValue({
      clientEmail: "e",
      issuerId: "3388",
      privateKey: "k",
    });
  });

  it("is 404 when Google Wallet is not configured", async () => {
    readGoogleWalletConfig.mockReturnValue(null);
    expect((await GET(request())).status).toBe(404);
  });

  it("is 404 when MEMBER_PASS_SECRET is not configured", async () => {
    vi.stubEnv("MEMBER_PASS_SECRET", "");
    expect((await GET(request())).status).toBe(404);
  });

  it("is 401 for a caller with no valid session, with CORS headers applied", async () => {
    resolveMemberPassForRequest.mockResolvedValue({
      state: "unauthenticated",
    });
    const response = await GET(request({ origin: "https://web.biso.no" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://web.biso.no"
    );
  });

  it("is 403 for a non-member", async () => {
    resolveMemberPassForRequest.mockResolvedValue({ state: "expired" });
    expect((await GET(request())).status).toBe(403);
  });

  it("writes the pass through the Wallet API, then returns a saveUrl JSON body", async () => {
    resolveMemberPassForRequest.mockResolvedValue(ACTIVE);
    const response = await GET(request({ origin: "https://web.biso.no" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://web.biso.no"
    );
    expect(await response.json()).toEqual({
      saveUrl: "https://pay.google.com/gp/v/save/header.payload.sig",
    });
    const object = syncGoogleWalletPass.mock.calls[0]?.[1] as {
      id: string;
      rotatingBarcode: {
        totpDetails: { parameters: { key: string }[] };
      };
    };
    expect(object.rotatingBarcode.totpDetails.parameters[0]?.key).toMatch(
      TOTP_KEY_HEX_RE
    );
    const input = signGoogleSaveJwt.mock.calls[0]?.[0] as {
      objectId: string;
      origins: string[];
    };
    expect(input.origins).toEqual(["https://biso.no"]);
    expect(input.objectId).toBe("3388.member-user-1");
    expect(input).not.toHaveProperty("genericObject");
  });

  it("is 502 when the Wallet API fails", async () => {
    resolveMemberPassForRequest.mockResolvedValue(ACTIVE);
    syncGoogleWalletPass.mockRejectedValueOnce(new Error("boom"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "wallet_unavailable" });
    expect(signGoogleSaveJwt).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("OPTIONS /api/member-pass/google", () => {
  it("answers CORS preflight", () => {
    const response = OPTIONS(request({ origin: "https://web.biso.no" }));
    expect(response.status).toBe(204);
  });
});
