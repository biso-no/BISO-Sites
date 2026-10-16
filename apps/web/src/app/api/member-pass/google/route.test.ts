import { beforeEach, describe, expect, it, vi } from "vitest";

const TOTP_KEY_HEX_RE = /^[0-9a-f]{40}$/;

const resolveMemberPass = vi.hoisted(() => vi.fn());
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
vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPass }));
vi.mock("@repo/shared/member-pass/wallet-config", () => ({
  readGoogleWalletConfig,
}));
vi.mock("@repo/shared/member-pass/google-pass", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@repo/shared/member-pass/google-pass")
  >()),
  signGoogleSaveJwt,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(async () => undefined),
}));

import { GET } from "./route";

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

describe("GET /api/member-pass/google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "MEMBER_PASS_SECRET",
      "test-secret-that-is-at-least-32-characters-long"
    );
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");
    readGoogleWalletConfig.mockReturnValue({
      clientEmail: "e",
      issuerId: "3388",
      privateKey: "k",
    });
  });

  it("is 404 when Google Wallet is not configured", async () => {
    readGoogleWalletConfig.mockReturnValue(null);
    expect((await GET()).status).toBe(404);
  });

  it("is 404 when MEMBER_PASS_SECRET is not configured", async () => {
    vi.stubEnv("MEMBER_PASS_SECRET", "");
    expect((await GET()).status).toBe(404);
  });

  it("is 401 for anonymous visitors", async () => {
    resolveMemberPass.mockResolvedValue({ state: "unauthenticated" });
    expect((await GET()).status).toBe(401);
  });

  it("is 403 for non-members", async () => {
    resolveMemberPass.mockResolvedValue({ state: "expired" });
    expect((await GET()).status).toBe(403);
  });

  it("writes the pass through the Wallet API, then redirects to the save link", async () => {
    resolveMemberPass.mockResolvedValue(ACTIVE);
    const response = await GET();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://pay.google.com/gp/v/save/header.payload.sig"
    );
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
    resolveMemberPass.mockResolvedValue(ACTIVE);
    syncGoogleWalletPass.mockRejectedValueOnce(new Error("boom"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await GET();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "wallet_unavailable" });
    expect(signGoogleSaveJwt).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
