import { beforeEach, describe, expect, it, vi } from "vitest";

const APPLE_CODE_RE = /^a1\.user-1\.20261231\./;

const resolveMemberPassForRequest = vi.hoisted(() => vi.fn());
const readAppleWalletConfig = vi.hoisted(() => vi.fn());
const buildAppleWalletPass = vi.hoisted(() =>
  vi.fn(async (_input: unknown) => Buffer.from("PKPASS"))
);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPassForRequest }));
vi.mock("@repo/shared/member-pass/wallet-config", () => ({
  readAppleWalletConfig,
}));
vi.mock("@repo/shared/member-pass/apple-pass", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@repo/shared/member-pass/apple-pass")
  >()),
  buildAppleWalletPass,
  loadWalletIcon: vi.fn(async () => Buffer.from("PNG")),
}));

import { GET, OPTIONS } from "./route";

const ACTIVE = {
  holder: {
    expiryDate: "2026-12-31",
    membershipName: "Semester",
    name: "Markus Heien",
    startDate: "2026-07-01",
    term: {
      duration: "semester",
      fromYear: 2026,
      season: "fall",
      toYear: 2026,
    },
  },
  state: "active",
  userId: "user-1",
};

function request(headers: Record<string, string> = {}) {
  return new Request("https://api.biso.no/api/member-pass/apple", {
    headers: { authorization: "Bearer jwt", ...headers },
  }) as never;
}

describe("GET /api/member-pass/apple", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "MEMBER_PASS_SECRET",
      "test-secret-that-is-at-least-32-characters-long"
    );
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "https://biso.no");
    readAppleWalletConfig.mockReturnValue({
      passTypeId: "p",
      signerCert: "c",
      signerKey: "k",
      teamId: "t",
      wwdr: "w",
    });
  });

  it("is 404 when Apple Wallet is not configured", async () => {
    readAppleWalletConfig.mockReturnValue(null);
    expect((await GET(request())).status).toBe(404);
  });

  it("is 404 when MEMBER_PASS_SECRET is not configured", async () => {
    vi.stubEnv("MEMBER_PASS_SECRET", "");
    expect((await GET(request())).status).toBe(404);
  });

  it("is 401 for a caller with no valid session and 403 for a non-member, with CORS headers applied", async () => {
    resolveMemberPassForRequest.mockResolvedValue({
      state: "unauthenticated",
    });
    const unauthenticated = await GET(
      request({ origin: "https://web.biso.no" })
    );
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get("access-control-allow-origin")).toBe(
      "https://web.biso.no"
    );
    resolveMemberPassForRequest.mockResolvedValue({ state: "not_member" });
    expect((await GET(request())).status).toBe(403);
  });

  it("returns a signed pass for members, with CORS and no-store headers", async () => {
    resolveMemberPassForRequest.mockResolvedValue(ACTIVE);
    const response = await GET(request({ origin: "https://web.biso.no" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.apple.pkpass"
    );
    expect(response.headers.get("content-disposition")).toContain(
      "biso-membership.pkpass"
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://web.biso.no"
    );
    const input = buildAppleWalletPass.mock.calls[0]?.[0] as {
      code: string;
      expiryDate: string;
      fields: { primary: { value: string }[] };
    };
    expect(input.code).toMatch(APPLE_CODE_RE);
    expect(input.expiryDate).toBe("2026-12-31");
    expect(input.fields.primary[0]?.value).toBe("Markus Heien");
  });

  it("localizes wallet labels from Accept-Language", async () => {
    resolveMemberPassForRequest.mockResolvedValue(ACTIVE);
    await GET(request({ "accept-language": "nb-NO,en;q=0.8" }));
    const input = buildAppleWalletPass.mock.calls[0]?.[0] as {
      fields: { primary: { label: string }[] };
    };
    expect(input.fields.primary[0]?.label).toBe("Medlem");
  });

  it("is 500 when building the pass fails", async () => {
    resolveMemberPassForRequest.mockResolvedValue(ACTIVE);
    buildAppleWalletPass.mockRejectedValueOnce(new Error("boom"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed" });
    consoleError.mockRestore();
  });
});

describe("OPTIONS /api/member-pass/apple", () => {
  it("answers CORS preflight", () => {
    const response = OPTIONS(request({ origin: "https://web.biso.no" }));
    expect(response.status).toBe(204);
  });
});
